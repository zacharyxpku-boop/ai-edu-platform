const api = require('../../utils/api');
const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');
const reviewCards = require('../../utils/review-cards');
const gameLogic = require('../../utils/game-logic');
const profileViewModels = require('../../view-models/profile-view-model');
const focusCabin = require('../../utils/focus-cabin');
const learningAssessment = require('../../utils/learning-assessment');
const learningReport = require('../../utils/learning-report');
const learningReportRecognition = require('../../utils/learning-report-recognition');
const openMaicInspiredPlan = require('../../utils/openmaic-inspired-plan');
const partnerDeliveryWorkbench = require('../../utils/partner-delivery-workbench');
function createShareRelaySchemaFallback() {
  const allowlist = [
    'share_intent',
    'share',
    'share_code',
    'from',
    'mode',
    'challenge',
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
    'relay_first_step',
    'relay_receiver_action',
    'relay_parent_check',
    'relay_next_revisit',
    'relay_allowed_fields',
    'relay_blocked_fields',
    'relay_completion_signal',
    'relay_return_path',
    'tonight_parent_question',
    'tonight_tomorrow_revisit',
    'tonight_release_gate',
    'tonight_share_boundary',
    'tonight_allowed_fields',
    'tonight_blocked_fields',
    'question_bank_relay_first_step',
    'question_bank_relay_wrong_cause',
    'question_bank_relay_next_action',
    'course_unit_parent_decision',
    'course_unit_share_contract',
    'course_unit_recall_route',
    'course_unit_game_route',
    'relay_review',
    'relay_spread_status',
    'relay_season_status',
    'wrong_cause_label',
    'wrong_cause_first_step',
    'wrong_cause_parent_check',
    'wrong_cause_receiver_action',
    'wrong_cause_next_revisit',
    'wrong_cause_allowed_fields',
    'wrong_cause_blocked_fields',
    'source_challenge_route',
    'openmaic_bridge_status',
    'openmaic_next_action',
    'openmaic_share_boundary',
    'openmaic_game_gate',
    'openmaic_blocked_fields',
    'openmaic_evidence',
    'openmaic_return_path'
  ];
  const denylist = ['original_question', 'original_answer', 'photo', 'raw_text', 'full_answer', 'full_solution', 'full_dialogue', 'score', 'ranking', 'private_comment', 'classmate_comparison', 'teacher_private_comment', 'complete_transcript'];
  function isAllowed(key) {
    return allowlist.indexOf(key) >= 0 && denylist.indexOf(key) < 0 && !/answer|solution|photo|score|rank|transcript/i.test(String(key || ''));
  }
  function toText(value) {
    return String(value == null ? '' : value).trim();
  }
  function buildSafeSharePayload(card = {}, intent = 'peer_challenge', extra = {}) {
    const source = Object.assign({}, card.payload || {}, extra || {});
    const safe = { share_intent: intent, from: 'profile', mode: 'safe_relay', allowed_fields: ['share_code', 'tonight_action', 'parent_question', 'tomorrow_check', 'safe_relay_allowed_fields'], blocked_fields: denylist.slice() };
    Object.keys(source).forEach((key) => {
      if (isAllowed(key)) safe[key] = toText(source[key]);
    });
    safe.sanitized = true;
    return safe;
  }
  function buildShareRelayQuery(path = '', payload = {}) {
    const base = toText(path);
    const query = Object.keys(payload || {})
      .filter((key) => payload[key] !== undefined && payload[key] !== null && payload[key] !== '')
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(toText(payload[key]))}`)
      .join('&');
    if (!query) return base;
    return `${base}${base.indexOf('?') >= 0 ? '&' : '?'}${query}`;
  }
  return { buildSafeSharePayload, buildShareRelayQuery };
}

let shareRelaySchema = null;
try {
  shareRelaySchema = require('../../utils/share-relay-schema');
} catch (error) {
  try {
    shareRelaySchema = require('../../utils/share-relay-schema.cjs');
  } catch (fallbackError) {
    shareRelaySchema = createShareRelaySchemaFallback();
  }
}

function sendMiniEvent(payload) {
  api.submitEvent(payload).catch(() => {});
}

let lastGeneratedShareCode = '';

const PARENT_GOALS = [
  { id: 'score', label: '先修卡点', strategy: '先抓高频卡点，再补同类题和小变式。', tutorMode: 'fast_mode', reviewBias: 'transfer' },
  { id: 'speed', label: '减少磨蹭', strategy: '把任务压成 15 分钟，先做必须做。', tutorMode: 'fast_mode', reviewBias: 'short' },
  { id: 'careless', label: '改掉粗心', strategy: '优先检查审题、单位、条件和符号。', tutorMode: 'check_answer', reviewBias: 'trap' },
  { id: 'understand', label: '先讲懂', strategy: '先确认孩子是否理解，再决定要不要加练。', tutorMode: 'hint', reviewBias: 'balanced' },
  { id: 'habit', label: '复习别断', strategy: '每天 5 分钟回访，卡点反复出现就优先修。', tutorMode: 'review', reviewBias: 'streak' }
];

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function profileReadableGate(raw = '') {
  const value = String(raw || '');
  if (!value) return '放行门槛：先补真实学习证据。';
  if (/real|homework|wrong|task|错题|作业/.test(value)) return '放行门槛：必须有真实作业或错题证据。';
  if (/day.?7|7/.test(value)) return '放行门槛：必须完成第 7 天小变式验证。';
  if (/parent|confirm|家长/.test(value)) return '放行门槛：家长确认范围后再进入交付。';
  if (/answer|solution|score|ranking|talent/.test(value)) return '放行门槛：不放答案、分数、排名或天赋标签。';
  return `放行门槛：${value}`;
}

function profileReadableOwner(raw = '') {
  const value = String(raw || '');
  if (!value) return '负责方：家庭和本地规则共同确认。';
  if (/ai/i.test(value)) return '负责方：AI 只负责表达、追问和总结。';
  if (/local|rule|code|本地|规则/.test(value)) return '负责方：本地规则负责安全、证据和放行。';
  if (/parent|family|家长|家庭/.test(value)) return '负责方：家长只确认范围和观察证据。';
  return `负责方：${value}`;
}

function profileListLine(label, values = []) {
  const list = Array.isArray(values) ? values : [values];
  const text = list.map((item) => String(item || '').trim()).filter(Boolean).join('、');
  return `${label}：${text || '按当前报告补齐后显示。'}`;
}

function normalizeProfileServiceHandoffPack(pack = null) {
  if (!pack || typeof pack !== 'object') return null;
  const cards = Array.isArray(pack.cards)
    ? pack.cards.map((item, index) => ({
      id: item.id || `profile_service_handoff_${index + 1}`,
      label: item.label || '交付步骤',
      line: item.line || '先把资料转成家庭能执行的一步。',
      evidenceLine: item.evidenceLine || '证据不足时只补证据，不下结论。'
    }))
    : [];
  return {
    id: pack.id || 'profile_uploaded_material_service_handoff_pack',
    title: pack.title || '家庭解决方案交付包',
    summaryLine: pack.summaryLine || '把上传材料、今晚动作、7 天验证和合作交付收成一张可执行卡。',
    cards,
    releaseLine: pack.releaseLine || '放行标准：必须有孩子自己的第一步、错因、回访或家长确认。',
    blockedLine: pack.blockedLine || '不交付：原题、完整答案、分数排名、天赋定性和隐私信息。'
  };
}

function buildProfileServiceHandoffActions(pack = null, servicePathway = null, handoff = null) {
  if (!pack) return [];
  const validationPlan = servicePathway && Array.isArray(servicePathway.validationPlan)
    ? servicePathway.validationPlan
    : [];
  const hasDay7Plan = validationPlan.some((item) => Number(item.day || 0) >= 7 || /7|小变式|迁移/.test(`${item.label || ''}${item.action || ''}${item.evidence || ''}`));
  const actionRoute = handoff && handoff.actionRoute
    ? handoff.actionRoute
    : '/pages/tutor/tutor?from=profile_service_handoff';
  const actions = [
    {
      id: 'service_handoff_tonight',
      label: '今晚先做一步',
      route: actionRoute,
      reason: '把交付包落到孩子今晚能说出的第一步。'
    },
    {
      id: 'service_handoff_day7',
      label: hasDay7Plan ? '进入 7 天验证' : '先补验证证据',
      route: '/pages/review/review?from=profile_service_handoff&stage=day7',
      reason: hasDay7Plan
        ? '用隔天回访和第 7 天小变式验证方法是否真的适合。'
        : '先补真实错题、回访和小变式，再进入长期画像。'
    },
    {
      id: 'service_handoff_parent_confirm',
      label: '补家长确认',
      route: '/pages/upload/upload?from=profile_service_handoff&type=parent_report',
      reason: '合作交付前先确认范围，只交付行动、问题和下一条证据。'
    }
  ];
  const seen = {};
  return actions.filter((item) => {
    const key = `${item.id}:${item.route}`;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function buildProfileDossierDeliveryView(dossier = {}, servicePathway = {}) {
  const modeOrchestration = dossier.familyPrivateTutorSolutionPack && Array.isArray(dossier.familyPrivateTutorSolutionPack.modeOrchestration)
    ? dossier.familyPrivateTutorSolutionPack.modeOrchestration
    : [];
  const solutionSequence = dossier.personalizedLearningSolutionBlueprint && Array.isArray(dossier.personalizedLearningSolutionBlueprint.modeSequence)
    ? dossier.personalizedLearningSolutionBlueprint.modeSequence
    : [];
  const serviceModes = servicePathway && Array.isArray(servicePathway.modeRecommendations)
    ? servicePathway.modeRecommendations
    : [];
  const aiLocalSplit = Array.isArray(dossier.aiLocalSplit)
    ? dossier.aiLocalSplit
    : [];
  const serviceAiLocalSplit = servicePathway && Array.isArray(servicePathway.aiLocalDeliverySplit)
    ? servicePathway.aiLocalDeliverySplit
    : [];
  return {
    id: 'profile_uploaded_material_delivery_view',
    modeCards: modeOrchestration.map((item, index) => ({
      id: item.id || `private_mode_${index + 1}`,
      label: item.label || '学习模式',
      whenLine: item.when || item.trigger || '有真实学习证据时使用。',
      gateLine: profileReadableGate(item.localGate),
      boundaryLine: '边界：默认仍是一对一苏格拉底点拨，小课堂和游戏只做补位。'
    })),
    solutionCards: solutionSequence.map((item, index) => ({
      id: item.id || `solution_mode_${index + 1}`,
      label: item.label || '方案步骤',
      triggerLine: item.trigger || '根据当前材料选择下一步。',
      gateLine: profileReadableGate(item.localGate),
      aiLine: item.aiRole ? `AI 辅助：${item.aiRole}` : 'AI 辅助：改写成孩子和家长能执行的话。'
    })),
    methodValidationCards: (Array.isArray(dossier.methodValidationStages) ? dossier.methodValidationStages : []).map((item, index) => ({
      id: item.id || `method_validation_${index + 1}`,
      label: item.label || '方法验证',
      ownerLine: profileReadableOwner(item.owner),
      unlockLine: item.unlocks ? `通过后解锁：${item.unlocks}` : '通过后解锁：下一次回访或服务建议。'
    })),
    aiLocalCards: aiLocalSplit.concat(serviceAiLocalSplit).map((item, index) => ({
      id: item.id || `ai_local_${index + 1}`,
      label: item.label || 'AI/规则分工',
      ownsLine: profileListLine('负责内容', item.owns),
      boundaryLine: '边界：AI 不决定答案、奖励、标签、隐私和商业放行。'
    })),
    serviceModeCards: serviceModes.map((item, index) => ({
      id: item.id || `service_mode_${index + 1}`,
      label: item.label || '服务模式',
      actionLine: item.action || '先完成一个低压动作。',
      gateLine: profileReadableGate(item.localGate),
      entryLine: item.route && item.route.indexOf('/pages/tutor/') >= 0
        ? '进入方式：回到一对一点拨。'
        : item.route && item.route.indexOf('/pages/review/') >= 0
          ? '进入方式：回到错因复盘。'
          : '进入方式：从当前报告继续。'
    })),
    releaseLine: profileReadableGate(
      dossier.methodValidationReleaseRule
      || (dossier.releaseGate && dossier.releaseGate.status)
      || (servicePathway && servicePathway.safetyBoundary && servicePathway.safetyBoundary.releaseGate)
    )
  };
}

function visibleLearningState() {
  return storage.loadState();
}

function buildSyncReadiness(identity, syncSummary, syncDiagnostics) {
  const authMode = identity && identity.auth_mode ? identity.auth_mode : 'local';
  const diagnostics = syncDiagnostics || {};
  const pending = safeNumber(syncSummary && syncSummary.pending, 0);
  const items = [
    {
      id: 'appid',
      label: '真实小程序 AppID',
      ready: authMode === 'wechat',
      detail: authMode === 'wechat' ? '微信会话已生效' : '配置真实 AppID 前仍是本地模式'
    },
    {
      id: 'session',
      label: '会话身份',
      ready: !!(identity && identity.client_id),
      detail: identity && identity.client_id ? identity.client_id : '还没有本地身份'
    },
    {
      id: 'queue',
      label: '同步队列',
      ready: diagnostics.conflictSafe !== false,
      detail: `${pending} 条待同步 / 序号 ${safeNumber(diagnostics.localSeq, 0)}`
    },
    {
      id: 'backend',
      label: '连续性服务',
      ready: !!(syncSummary && syncSummary.readyForCloud),
      detail: syncSummary && syncSummary.readyForCloud ? '多设备连续性协议已就绪' : '仍需要完成账号、服务域名和运行配置'
    }
  ];
  const ready = items.filter((item) => item.ready).length;
  return {
    title: '同步准备',
    score: Math.round((ready / items.length) * 100),
    label: `${ready}/${items.length} 个生产同步条件已就绪。`,
    items,
    next: authMode === 'wechat'
      ? '运行同步并确认账号连续性服务。'
      : '上传前配置正式小程序 AppID、请求域名和服务安全配置。'
  };
}

function buildParentReport(profile, reviewSummary, moduleSummary, tutorSummary, calibrationProfile, syncSummary, thinkingSummary, parentGoal, todayFocus) {
  const review = reviewSummary || {};
  const modules = moduleSummary || {};
  const tutor = tutorSummary || {};
  const thinking = thinkingSummary || {};
  const calibration = calibrationProfile || {};
  const state = visibleLearningState() || {};
  const weakPoint = (todayFocus && todayFocus.title) || calibration.weakPoint || (((state.weak_points || [])[0] || {}).name) || '当前重点';
  const issueName = todayFocus && todayFocus.issueType ? `${storage.formatIssueType(todayFocus.issueType)}：${weakPoint}` : weakPoint;
  const reviewAccuracy = safeNumber(review.accuracy || (calibration.review && calibration.review.accuracyRate), 0);
  const totalAssets = safeNumber(review.total, 0)
    + safeNumber(review.notes, 0)
    + safeNumber(modules.completed, 0)
    + safeNumber(tutor.completed, 0)
    + safeNumber(thinking.total, 0);
  const recordScore = Math.min(100, 52
    + Math.min(14, safeNumber(tutor.completed, 0) * 7)
    + Math.min(12, safeNumber(modules.completed, 0) * 6)
    + Math.min(12, Math.round(reviewAccuracy / 10))
    + Math.min(10, safeNumber(review.streak, 0) * 2)
    + Math.min(6, safeNumber(thinking.diagnosticProbes, 0) * 2)
    + Math.min(4, safeNumber(thinking.transferPrompts, 0) * 2)
    + Math.min(8, Math.round(safeNumber(thinking.avgScore, 0) / 13)));
  const label = todayFocus && todayFocus.title
    ? `当前重点：${issueName}。今晚建议：${todayFocus.recommendation || '先做 1 道同类题 + 1 道小变式'}。`
    : recordScore >= 86
    ? '这周已经能看见孩子卡在哪、怎么改、下次先查什么。'
    : recordScore >= 68
      ? '这套闭环已经开始起作用，但还需要更多复习和卡点记录。'
      : '今晚先做一项必须做、一轮卡点修复、一次短复习。';
  const recordStatus = recordScore >= 86 ? '记录稳定' : recordScore >= 68 ? '正在形成' : '继续积累';
  const goal = parentGoal || {};
  const goalLine = goal.strategy ? `家庭目标：${goal.label}。${goal.strategy}` : '';

    return {
      title: `${profile && profile.name ? profile.name : '孩子'}本周学习记录`,
      label: goalLine ? `${label} ${goalLine}` : label,
      recordStatus,
      recordStatusLabel: recordStatus,
      weakPoint: issueName,
      sourceText: todayFocus && (todayFocus.sourceText || todayFocus.thought),
      thinkingProbeLine: `追问 ${safeNumber(thinking.diagnosticProbes, 0)} 次 · 迁移提示 ${safeNumber(thinking.transferPrompts, 0)} 次`,
      parentHelp: '先让孩子说第一步，不要直接讲最终结果。',
    inspectionLine: todayFocus && todayFocus.repairStatus === 'completed'
      ? `今晚已经修过「${weakPoint}」，收尾问一句：下次第一步先查什么？`
      : `我能不能说清「${weakPoint}」为什么卡住、下次第一步先做什么？`,
    shareLine: `这周：完成 ${safeNumber(tutor.completed, 0)} 次关键点拨，沉淀 ${safeNumber(review.total, 0)} 张复习卡，留下 ${safeNumber(thinking.total, 0)} 条思路记录。`,
    recordLine: `我的学习记录 ${totalAssets} 项。作业、点拨、复习和卡点正在慢慢连起来。`,
    recordCards: [
      {
        id: 'must_do',
        value: safeNumber(tutor.completed, 0),
        label: '关键点拨',
        note: '作业点拨只用在最值得今晚先做的任务上。'
      },
      {
        id: 'memory',
        value: safeNumber(review.total, 0),
        label: '复习资产',
        note: '重要方法会进入长期复习，而不是只学今晚。'
      },
      {
        id: 'accuracy',
        value: `${reviewAccuracy}%`,
        label: '复习正确率',
        note: '这是掌握趋势，不是结果承诺。'
      },
      {
        id: 'thinking',
        value: thinking.total ? `${safeNumber(thinking.avgScore, 0)}` : 0,
        label: '思路记录',
        note: '看孩子有没有先想一步、说清卡点、知道下次先查什么。'
      },
      {
        id: 'sync',
        value: safeNumber(syncSummary && syncSummary.pending, 0),
        label: '待同步',
        note: '接入真实 AppID 和账号服务后可多设备连续使用。'
      }
    ],
    nextActions: [
      { id: 'upload', label: '更新今晚作业', action: 'upload', detail: '刷新三分类' },
      { id: 'arcade', label: '去轻回访', action: 'arcade', detail: '复习一个卡点' },
      { id: 'review', label: '开始复习', action: 'review', detail: '把方法记住' },
      { id: 'tutor', label: '辅导必须做', action: 'tutor', detail: '只给最小提示' }
    ],
    assets: [
      { id: 'calibration', label: '反馈校准', value: calibration.label || '还在积累中' },
      { id: 'weak', label: '当前重点', value: weakPoint },
      { id: 'module', label: '主要学科', value: modules.topSubject || (profile && profile.subject) || '学习中' },
      { id: 'thinking', label: '卡点记录', value: thinking.label || '还没有思路记录' },
      { id: 'queue', label: '同步状态', value: syncSummary && syncSummary.label ? syncSummary.label : '本地记录已就绪' }
    ]
  };
}

function buildTutorProcessSummary(todayFocus, thinkingReceipts, tutorMessages) {
  const receipts = Array.isArray(thinkingReceipts) ? thinkingReceipts : [];
  const messages = Array.isArray(tutorMessages) ? tutorMessages : [];
  const latestReceipt = receipts[0] || {};
  const fallbackBridge = latestReceipt.fallback_recovery_bridge || null;
  const childText = (todayFocus && (todayFocus.sourceText || todayFocus.thought))
    || latestReceipt.selected_text
    || ((messages || []).filter((item) => item.role === 'user').slice(-1)[0] || {}).text
    || '还没有留下完整原话。';
  const tutorText = ((messages || []).filter((item) => item.role === 'assistant').slice(0, 1)[0] || {}).text
    || '先说你想到的第一步就行，不用完整。';
  const repairedStep = todayFocus && todayFocus.repairStatus === 'completed'
    ? (todayFocus.title || '今天这个卡点')
    : (todayFocus && todayFocus.title) || latestReceipt.focus || '第一步';
  return {
    title: '点拨过程摘要',
    safetyLine: '今天咕点没有直接给答案，而是让孩子先说第一步。',
    collapsed: true,
    items: [
      { id: 'child', label: '孩子原话', text: childText },
      { id: 'prompt', label: '咕点追问', text: tutorText },
      fallbackBridge ? { id: 'fallback', label: '失败兜底', text: fallbackBridge.reportLine || fallbackBridge.nextSmallAction || '' } : null,
      fallbackBridge ? { id: 'blackboard', label: '小黑板', text: fallbackBridge.blackboardLine || '' } : null
    ].filter(Boolean).slice(0, 4),
    fallbackRecoveryBridge: fallbackBridge,
    fallbackRecoveryLine: fallbackBridge ? fallbackBridge.reportLine : '',
    fallbackParentDecisionLine: fallbackBridge ? fallbackBridge.parentDecisionLine : '',
    fallbackShareBoundary: fallbackBridge ? fallbackBridge.shareBoundary : '',
    repairedStep,
    noDirectAnswer: true
  };
}

function buildRouteStrip(active, tonightPlan) {
  const steps = (tonightPlan && tonightPlan.routeSteps) || [
    { id: 'plan', label: '排顺序' },
    { id: 'first_step', label: '说第一步' },
    { id: 'repair', label: '修卡点' },
    { id: 'review', label: '轻回访' },
    { id: 'parent', label: '家长看' }
  ];
  return {
    text: '今晚路线：排顺序 → 说第一步 → 修卡点 → 轻回访 → 家长看',
    steps: steps.map((step) => Object.assign({}, step, { active: step.id === active }))
  };
}

function buildTonightRouteSummary(tonightPlan, todayFocus, reviewSummary) {
  const plan = tonightPlan || {};
  const first = (plan.planItems || [])[0] || {};
  const focusTitle = todayFocus && todayFocus.title ? todayFocus.title : '今晚先修这一处';
  const dueCount = Array.isArray(plan.reviewCardIds) ? plan.reviewCardIds.length : safeNumber(reviewSummary && reviewSummary.due, 0);
  return {
    why: plan.summaryLine || '今晚不是多做题，而是先排顺序，再把最容易卡住的一步修掉。',
    firstAction: first.title ? `${first.priorityLabel || '先做'}：${first.title}` : '先排学校任务，再留一点时间修卡点。',
    focus: todayFocus && todayFocus.issueType ? `${storage.formatIssueType(todayFocus.issueType)} · ${focusTitle}` : focusTitle,
    review: dueCount ? `明天回访 ${dueCount} 张卡点卡。` : '明天用 1 道同类题轻轻回访。',
    parentPrompt: plan.parentPrompt || '你觉得这题第一步应该找什么？',
    status: [
      plan.id ? '已排顺序' : '待排顺序',
      todayFocus && todayFocus.id ? '已找到卡点' : '待说第一步',
      todayFocus && todayFocus.repairStatus === 'completed' ? '已修卡点' : '待修卡点',
      dueCount ? '已生成明日回访' : '待生成回访',
      '家长可查看'
    ].join(' / ')
  };
}

function buildParentLoopProof(reviewSummary, moduleSummary, tutorSummary, thinkingSummary, factorySummary) {
  const review = reviewSummary || {};
  const modules = moduleSummary || {};
  const tutor = tutorSummary || {};
  const thinking = thinkingSummary || {};
  const factory = factorySummary || {};
  const loop = review.loop || {};
  const progress = review.progress || {};
  return {
    title: '晚间闭环记录',
    label: '只展示孩子已经产生的真实记录，不展示模拟排行或未上线的社交玩法。',
    cards: [
      { id: 'material', label: '材料生成', value: safeNumber(factory.imported, 0), body: '真实材料导入复习卡' },
      { id: 'challenge', label: '轻回访', value: safeNumber(review.due, 0), body: '今天到期的回忆卡' },
      { id: 'xp', label: '回访', value: safeNumber(progress.xp, 0), body: `连续 ${safeNumber(loop.currentStreak || progress.streak, 0)} 天有记录` },
      { id: 'repair', label: '卡点修复', value: safeNumber(review.leeches, 0), body: '反复卡点会优先回访' },
      { id: 'thinking', label: '思路记录', value: safeNumber(thinking.total, 0), body: '点拨留下的卡点和下一步' },
      { id: 'feedback', label: '反馈校准', value: safeNumber((storage.loadFeedback && storage.loadFeedback().length) || 0), body: '反馈会调整后续建议' }
    ],
    next: safeNumber(review.total, 0)
        ? '下一步：完成一轮 5 分钟复习，再看卡点是否能说清。'
      : '下一步：先导入真实材料，生成第一组回忆卡。'
  };
}

function buildWrongCauseSummary(reviewSummary, thinkingSummary) {
  const cards = storage.loadReviewCards ? storage.loadReviewCards() : [];
  const buckets = [
    {
      id: 'concept',
      label: '概念不清',
      level: 'clear',
      keywords: /概念|定义|为什么|原理|关系|knowledge|concept/i
    },
    {
      id: 'step',
      label: '步骤断点',
      level: 'review',
      keywords: /步骤|第一步|先|再|然后|方法|建模|step/i
    },
    {
      id: 'reading',
      label: '审题偏差',
      level: 'careless',
      keywords: /审题|题目|条件|单位|未知|已知|读题|目标量|trap/i
    },
    {
      id: 'answer_shortcut',
      label: '结果捷径',
      level: 'calc',
      keywords: /答案|代写|直接|shortcut|blocked|boundary/i
    }
  ].map((item) => Object.assign({}, item, { count: 0 }));

  cards.forEach((card) => {
    const text = [
      card.type,
      card.template,
      card.weakPoint,
      card.question,
      card.answer,
      card.reason,
      card.calibrationKey
    ].join(' ');
    const hit = buckets.find((bucket) => bucket.keywords.test(text));
    if (hit) hit.count += 1;
  });

  const thinking = thinkingSummary || {};
  if (thinking.blocked || thinking.answerBoundary) {
    const shortcut = buckets.find((item) => item.id === 'answer_shortcut');
    if (shortcut) shortcut.count += safeNumber(thinking.blocked || thinking.answerBoundary, 0);
  }

  const total = buckets.reduce((sum, item) => sum + item.count, 0);
  return {
    total,
    label: total ? `来自 ${total} 条复习/思考记录` : '还没有足够卡点记录',
    cards: buckets.map((item) => ({
      id: item.id,
      label: item.label,
      level: item.level,
      count: item.count,
      display: total ? item.count : '待积累'
    }))
  };
}

function buildGameProfileCard(reviewSummary) {
  const gameProfile = storage.loadGameProfile ? storage.loadGameProfile() : {};
  const progress = (reviewSummary && reviewSummary.progress) || {};
  const level = gameLogic.getLevel(gameProfile.xp || progress.xp || 0);
  const achievements = gameLogic.listAchievements(gameProfile.achievements || []);
  const unlocked = achievements.filter((item) => item.unlocked);
  const shopItems = gameLogic.listShopItems(gameProfile.inventory || []).slice(0, 3);
  return {
    title: '轻回访记录',
    xp: Number(gameProfile.xp || progress.xp || 0),
    coins: Number(gameProfile.coins || 0),
    streak: Number(gameProfile.streak || progress.streak || 0),
    lives: Number(gameProfile.lives || 5),
    level,
    achievements,
    unlockedCount: unlocked.length,
    achievementText: unlocked.length ? `已留下 ${unlocked.length}/${achievements.length} 条阶段记录` : '完成第一次回访后留下记录',
    shopItems,
    leaderboardNotice: '这里只看孩子自己的回访记录，不做同学榜。'
  };
}

function buildShareCode(profile, reviewSummary, gameProfileCard) {
  const name = (profile && profile.name) || 'learner';
  const source = [
    name,
    safeNumber(gameProfileCard && gameProfileCard.xp, 0),
    safeNumber(gameProfileCard && gameProfileCard.streak, 0),
    safeNumber(reviewSummary && reviewSummary.total, 0),
    new Date().toISOString().slice(0, 10)
  ].join('|');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).slice(0, 6).toUpperCase();
}

function buildDailyShareCard(profile, reviewSummary, gameProfileCard, wrongCauseSummary, todayFocus, globalEvidenceBrief, reportDailyActionQueue, unifiedNextAction, capabilityEvidenceLedger, subjectSkillDepth, curriculumSpine, visualSocraticMatrix, courseUnitMap, learningReportSummary) {
  const review = reviewSummary || {};
  const game = gameProfileCard || {};
  const progress = review.progress || {};
  const wrong = wrongCauseSummary || {};
  const repaired = Array.isArray(wrong.cards)
    ? wrong.cards.reduce((sum, item) => sum + safeNumber(item.count, 0), 0)
    : 0;
  const xp = safeNumber(game.xp, 0);
  const streak = safeNumber(game.streak, 0);
  const level = game.level || {};
  const due = safeNumber(review.due, 0);
  const total = safeNumber(review.total, 0);
  const reviewedToday = safeNumber(review.reviewedToday, 0);
  const mastered = safeNumber(review.mastered, 0);
  const code = buildShareCode(profile, review, game);
  const identityTag = repaired > 0
    ? '卡点修复者'
    : streak >= 7
      ? '连续回访者'
      : total >= 10
        ? '第一步思考者'
        : '第一步练习者';
  const title = todayFocus && todayFocus.repairStatus === 'completed'
    ? `今天修过一处：${todayFocus.title}`
    : xp || streak || total
    ? `我今天完成了一次真实轻回访：${identityTag}`
    : '我整理了一张原点智学复盘卡';
  const shareVariant = repaired > 0 ? 'wrong_cause' : streak >= 7 ? 'streak' : total >= 10 ? 'thinking' : 'starter';
  const parentNextAction = repaired > 0 ? 'wrong_cause_revisit' : due > 0 ? 'due_card_revisit' : 'first_step_revisit';
  const unifiedAction = unifiedNextAction || (storage.buildUnifiedNextActionController ? storage.buildUnifiedNextActionController({ surface: 'profile' }) : null);
  const unifiedActionLabel = unifiedAction && unifiedAction.actionLabel ? unifiedAction.actionLabel : '';
  const unifiedActionDetail = unifiedAction && unifiedAction.reasonLine ? unifiedAction.reasonLine : '';
  const unifiedQuery = `&action_label=${encodeURIComponent(unifiedActionLabel)}&action_detail=${encodeURIComponent(unifiedActionDetail)}`;
  const evidenceBrief = globalEvidenceBrief || (storage.buildGlobalEvidenceBrief ? storage.buildGlobalEvidenceBrief() : null);
  const capabilityLedger = capabilityEvidenceLedger || (storage.buildCapabilityEvidenceLedger ? storage.buildCapabilityEvidenceLedger({ globalEvidenceBrief: evidenceBrief }) : null);
  const nextCapability = capabilityLedger && capabilityLedger.nextCapability ? capabilityLedger.nextCapability : null;
  const capabilityQuery = nextCapability
    ? `&capability_gap=${encodeURIComponent(nextCapability.id || '')}&capability_label=${encodeURIComponent(nextCapability.label || '')}&capability_next_action=${encodeURIComponent(nextCapability.nextAction || '')}&capability_route=${encodeURIComponent(nextCapability.route || '')}`
    : '';
  const shareChallengePlan = storage.buildShareChallengePlan ? storage.buildShareChallengePlan({
    focus: todayFocus,
    capability: nextCapability || {},
    subjectSkillDepth,
    parentNextAction,
    actionLabel: unifiedActionLabel,
    route: nextCapability && nextCapability.route ? nextCapability.route : '/pages/arcade/arcade'
  }) : null;
  const questionBankShareRelayDeck = storage.buildQuestionBankShareRelayDeck ? storage.buildQuestionBankShareRelayDeck({
    courseUnitMap,
    shareChallengePlan,
    subjectSkillDepth
  }) : null;
  const activeRelayCard = questionBankShareRelayDeck && Array.isArray(questionBankShareRelayDeck.relayCards)
    ? questionBankShareRelayDeck.relayCards[0]
    : null;
  const questionBankVisualShareRelayDeck = storage.buildQuestionBankVisualShareRelayDeck ? storage.buildQuestionBankVisualShareRelayDeck({
    questionBankShareRelayDeck,
    courseUnitMap,
    shareChallengePlan,
    subjectSkillDepth
  }) : null;
  const challengeQuery = shareChallengePlan && shareChallengePlan.query
    ? `&challenge_goal=${encodeURIComponent(shareChallengePlan.query.challenge_goal || '')}&challenge_rule=${encodeURIComponent(shareChallengePlan.query.challenge_rule || '')}&challenge_route=${encodeURIComponent(shareChallengePlan.query.challenge_route || '')}&relay_privacy=${encodeURIComponent(shareChallengePlan.query.relay_privacy || '')}&relay_review=${encodeURIComponent(shareChallengePlan.query.relay_review || '')}&relay_first_step=${encodeURIComponent(shareChallengePlan.query.relay_first_step || '')}&relay_invite_line=${encodeURIComponent(shareChallengePlan.query.relay_invite_line || '')}&relay_receiver_prompt=${encodeURIComponent(shareChallengePlan.query.relay_receiver_prompt || '')}&relay_parent_reassurance=${encodeURIComponent(shareChallengePlan.query.relay_parent_reassurance || '')}&relay_day7_return=${encodeURIComponent(shareChallengePlan.query.relay_day7_return || '')}&relay_proof_signal=${encodeURIComponent(shareChallengePlan.query.relay_proof_signal || '')}&relay_guardrail=${encodeURIComponent(shareChallengePlan.query.relay_guardrail || '')}&relay_id=${encodeURIComponent(shareChallengePlan.query.relay_id || '')}&relay_receiver_action=${encodeURIComponent(shareChallengePlan.query.relay_receiver_action || '')}&relay_parent_check=${encodeURIComponent(shareChallengePlan.query.relay_parent_check || '')}&relay_next_revisit=${encodeURIComponent(shareChallengePlan.query.relay_next_revisit || '')}&relay_allowed_fields=${encodeURIComponent(shareChallengePlan.query.relay_allowed_fields || '')}&relay_blocked_fields=${encodeURIComponent(shareChallengePlan.query.relay_blocked_fields || '')}&relay_completion_signal=${encodeURIComponent(shareChallengePlan.query.relay_completion_signal || '')}&relay_return_path=${encodeURIComponent(shareChallengePlan.query.relay_return_path || '')}&relay_spread_status=${encodeURIComponent(shareChallengePlan.query.relay_spread_status || '')}&relay_spread_score=${encodeURIComponent(shareChallengePlan.query.relay_spread_score || '')}&relay_spread_line=${encodeURIComponent(shareChallengePlan.query.relay_spread_line || '')}&relay_spread_fallback=${encodeURIComponent(shareChallengePlan.query.relay_spread_fallback || '')}&relay_spread_reason=${encodeURIComponent(shareChallengePlan.query.relay_spread_reason || '')}&relay_spread_required=${encodeURIComponent(shareChallengePlan.query.relay_spread_required || '')}&relay_ladder=${encodeURIComponent(shareChallengePlan.query.relay_ladder || '')}&relay_attraction_hook=${encodeURIComponent(shareChallengePlan.query.relay_attraction_hook || '')}&relay_local_gate=${encodeURIComponent(shareChallengePlan.query.relay_local_gate || '')}&relay_season=${encodeURIComponent(shareChallengePlan.query.relay_season || '')}&relay_season_status=${encodeURIComponent(shareChallengePlan.query.relay_season_status || '')}&relay_season_line=${encodeURIComponent(shareChallengePlan.query.relay_season_line || '')}&relay_season_days=${encodeURIComponent(shareChallengePlan.query.relay_season_days || '')}&relay_season_gate=${encodeURIComponent(shareChallengePlan.query.relay_season_gate || '')}&wrong_cause_pack=${encodeURIComponent(shareChallengePlan.query.wrong_cause_pack || '')}&wrong_cause_label=${encodeURIComponent(shareChallengePlan.query.wrong_cause_label || '')}&wrong_cause_first_step=${encodeURIComponent(shareChallengePlan.query.wrong_cause_first_step || '')}&wrong_cause_parent_check=${encodeURIComponent(shareChallengePlan.query.wrong_cause_parent_check || '')}&wrong_cause_receiver_action=${encodeURIComponent(shareChallengePlan.query.wrong_cause_receiver_action || '')}&wrong_cause_next_revisit=${encodeURIComponent(shareChallengePlan.query.wrong_cause_next_revisit || '')}&wrong_cause_allowed_fields=${encodeURIComponent(shareChallengePlan.query.wrong_cause_allowed_fields || '')}&wrong_cause_blocked_fields=${encodeURIComponent(shareChallengePlan.query.wrong_cause_blocked_fields || '')}&wrong_cause_return_path=${encodeURIComponent(shareChallengePlan.query.wrong_cause_return_path || '')}&wrong_cause_gate=${encodeURIComponent(shareChallengePlan.query.wrong_cause_gate || '')}`
    : '';
  const sourceChallengeQuery = shareChallengePlan && shareChallengePlan.query
    ? `&source_challenge_count=${encodeURIComponent(shareChallengePlan.query.source_challenge_count || '')}&source_challenge_first=${encodeURIComponent(shareChallengePlan.query.source_challenge_first || '')}&source_challenge_prompt=${encodeURIComponent(shareChallengePlan.query.source_challenge_prompt || '')}&source_challenge_license=${encodeURIComponent(shareChallengePlan.query.source_challenge_license || '')}&source_challenge_decision=${encodeURIComponent(shareChallengePlan.query.source_challenge_decision || '')}&source_challenge_local_rule=${encodeURIComponent(shareChallengePlan.query.source_challenge_local_rule || '')}&source_challenge_blocked=${encodeURIComponent(shareChallengePlan.query.source_challenge_blocked || '')}&source_challenge_route=${encodeURIComponent(shareChallengePlan.query.source_challenge_route || '')}`
    : '';
  const openMaicDecisionBridge = learningReportSummary && learningReportSummary.openMaicDecisionBridge
    ? learningReportSummary.openMaicDecisionBridge
    : null;
  const openMaicQuery = openMaicDecisionBridge
    ? `&openmaic_bridge_status=${encodeURIComponent(openMaicDecisionBridge.status || openMaicDecisionBridge.id || '')}&openmaic_next_action=${encodeURIComponent(openMaicDecisionBridge.nextAction || '')}&openmaic_share_boundary=${encodeURIComponent(openMaicDecisionBridge.shareBoundary || '')}&openmaic_game_gate=${encodeURIComponent(openMaicDecisionBridge.gameReturnEvidence && openMaicDecisionBridge.gameReturnEvidence.rewardGate || '')}&openmaic_blocked_fields=${encodeURIComponent((openMaicDecisionBridge.shareRelayPayload && openMaicDecisionBridge.shareRelayPayload.blockedFields || []).join(','))}&openmaic_evidence=${encodeURIComponent((openMaicDecisionBridge.evidenceList || []).slice(0, 3).join(' / '))}&openmaic_return_path=${encodeURIComponent(openMaicDecisionBridge.shareRelayPayload && openMaicDecisionBridge.shareRelayPayload.path || '')}`
    : '';
  const questionBankRelayQuery = activeRelayCard
    ? `&question_bank_relay_label=${encodeURIComponent(activeRelayCard.label || '')}&question_bank_relay_first_step=${encodeURIComponent(activeRelayCard.firstStep || '')}&question_bank_relay_parent_check=${encodeURIComponent(activeRelayCard.parentCheck || '')}&question_bank_relay_route=${encodeURIComponent(activeRelayCard.route || '')}&question_bank_relay_boundary=${encodeURIComponent(questionBankShareRelayDeck.shareLine || '')}`
    : '';
  const visualRelayQuery = questionBankVisualShareRelayDeck && questionBankVisualShareRelayDeck.safeQuery
    ? `&visual_board_relay_title=${encodeURIComponent(questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_title || '')}&visual_board_relay_layer=${encodeURIComponent(questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_layer || '')}&visual_board_relay_student_line=${encodeURIComponent(questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_student_line || '')}&visual_board_relay_parent_line=${encodeURIComponent(questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_parent_line || '')}&visual_board_relay_exit=${encodeURIComponent(questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_exit || '')}&visual_board_relay_route=${encodeURIComponent(questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_route || '')}&visual_board_relay_boundary=${encodeURIComponent(questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_boundary || '')}`
    : '';
  const socraticMemoryRelay = learningReportSummary && learningReportSummary.socraticMemoryReportBridge
    ? {
      title: learningReportSummary.socraticMemoryReportTitle || '点拨质量接力',
      status: learningReportSummary.socraticMemoryReportStatus || '',
      action: learningReportSummary.socraticMemoryReportPrimaryAction || '',
      decision: learningReportSummary.socraticMemoryReportDecisionLine || '',
      noIncreaseRule: learningReportSummary.socraticMemoryReportNoIncreaseRule || '',
      parentProof: learningReportSummary.socraticMemoryReportParentProofLine || '',
      shareBoundary: learningReportSummary.socraticMemoryReportShareBoundary || ''
    }
    : null;
  const socraticReportQuery = socraticMemoryRelay
    ? `&socratic_report_status=${encodeURIComponent(socraticMemoryRelay.status)}&socratic_report_action=${encodeURIComponent(socraticMemoryRelay.action)}&socratic_report_decision=${encodeURIComponent(socraticMemoryRelay.decision)}&socratic_report_no_increase=${encodeURIComponent(socraticMemoryRelay.noIncreaseRule)}&socratic_report_parent_proof=${encodeURIComponent(socraticMemoryRelay.parentProof)}&socratic_report_boundary=${encodeURIComponent(socraticMemoryRelay.shareBoundary)}`
    : '';
  const tonightDecisionRelay = learningReportSummary && learningReportSummary.tonightDecisionBrief
    ? {
      title: learningReportSummary.tonightDecisionTitle || '今晚决策书',
      headline: learningReportSummary.tonightDecisionHeadline || '',
      parentQuestion: learningReportSummary.tonightDecisionParentScript || '',
      tomorrow: learningReportSummary.tonightDecisionTomorrowRevisit || '',
      releaseGate: learningReportSummary.tonightDecisionReleaseGate || '',
      shareLine: learningReportSummary.tonightDecisionShareLine || '',
      allowedFields: learningReportSummary.tonightDecisionSharePayload && learningReportSummary.tonightDecisionSharePayload.allowed_fields,
      blockedFields: learningReportSummary.tonightDecisionSharePayload && learningReportSummary.tonightDecisionSharePayload.blocked_fields
    }
    : null;
  const tonightDecisionQuery = tonightDecisionRelay
    ? `&tonight_decision=${encodeURIComponent(tonightDecisionRelay.headline)}&tonight_parent_question=${encodeURIComponent(tonightDecisionRelay.parentQuestion)}&tonight_tomorrow=${encodeURIComponent(tonightDecisionRelay.tomorrow)}&tonight_release_gate=${encodeURIComponent(tonightDecisionRelay.releaseGate)}&tonight_share_boundary=${encodeURIComponent(tonightDecisionRelay.shareLine)}`
    : '';
  const courseUnitDecision = buildCourseUnitDecisionBoard(courseUnitMap);
  const courseUnitQuery = courseUnitDecision
    ? `&course_unit_label=${encodeURIComponent(courseUnitDecision.unitLabel || '')}&course_unit_subject=${encodeURIComponent(courseUnitDecision.subjectLabel || '')}&course_unit_tier=${encodeURIComponent(courseUnitDecision.tier || '')}&course_unit_parent_decision=${encodeURIComponent(courseUnitDecision.parentTonightDecision || '')}&course_unit_report_contract=${encodeURIComponent(courseUnitDecision.reportContract || '')}&course_unit_share_contract=${encodeURIComponent(courseUnitDecision.shareContract || '')}&course_unit_blackboard=${encodeURIComponent(courseUnitDecision.blackboardLine || '')}&course_unit_recall_route=${encodeURIComponent(courseUnitDecision.recallRoute || '')}&course_unit_game_route=${encodeURIComponent(courseUnitDecision.gameRoute || '')}`
    : '';
  const path = `/pages/home/home?share=${code}&from=daily_card&challenge=arcade&mode=same_identity&identity=${encodeURIComponent(identityTag)}&action=${parentNextAction}${unifiedQuery}${capabilityQuery}${challengeQuery}${sourceChallengeQuery}${openMaicQuery}${courseUnitQuery}${socraticReportQuery}${tonightDecisionQuery}${questionBankRelayQuery}${visualRelayQuery}`;
  const parentPath = `/pages/home/home?share=${code}&from=parent_card&mode=parent_recap&identity=${encodeURIComponent(identityTag)}&action=${parentNextAction}${unifiedQuery}${capabilityQuery}${challengeQuery}${sourceChallengeQuery}${openMaicQuery}${courseUnitQuery}${socraticReportQuery}${tonightDecisionQuery}${questionBankRelayQuery}${visualRelayQuery}`;
  const peerPath = `/pages/home/home?share=${code}&from=peer_challenge&challenge=arcade&mode=same_identity&identity=${encodeURIComponent(identityTag)}&action=${parentNextAction}${unifiedQuery}${capabilityQuery}${challengeQuery}${sourceChallengeQuery}${openMaicQuery}${courseUnitQuery}${socraticReportQuery}${tonightDecisionQuery}${questionBankRelayQuery}${visualRelayQuery}`;
  const parentShareTitle = todayFocus && todayFocus.title
    ? `今晚先看这一处：${storage.formatIssueType(todayFocus.issueType || '卡点')} · ${todayFocus.title}`
    : '给家里看的今日学习复盘';
  const peerShareTitle = `今天轻回访 5 分钟：${identityTag}`;
  const shareCount = storage.loadShareRuns ? storage.loadShareRuns().length : 0;
  const reportAction = reportDailyActionQueue && reportDailyActionQueue.ready
    ? reportDailyActionQueue
    : (storage.buildReportDailyActionQueue ? storage.buildReportDailyActionQueue() : null);
  const actionFocus = todayFocus && todayFocus.title ? todayFocus.title : (repaired > 0 ? '最近的高频卡点' : '今晚第一步');
  const oneQuestion = todayFocus && todayFocus.childArticulatedStep
    ? `你刚才说“${todayFocus.childArticulatedStep}”，下次还先这样做吗？`
    : todayFocus && todayFocus.title
      ? `这处卡点下次第一步先检查什么？`
      : '你第一步先看了哪里？';
  const tonightAction = todayFocus && todayFocus.repairStatus === 'completed'
    ? `今晚只复述一次：${actionFocus} 的第一步。`
    : due > 0
      ? `今晚清 1 张待回访卡，再说出第一步。`
      : `今晚只做 1 个小动作：说清 ${actionFocus}。`;
  const tomorrowCheck = repaired > 0
    ? '明天先回看这张错因卡，确认换题也能开口。'
    : due > 0
      ? '明天先清一张待回访卡，忘了就回到提示卡。'
      : '明天继续让孩子先说第一步，再决定要不要加练。';
  const evidenceLine = [
    total ? `${total} 张学习卡` : '',
    reviewedToday ? `今日回访 ${reviewedToday} 张` : '',
    repaired ? `${repaired} 个卡点记录` : '',
    todayFocus && todayFocus.repairStatus === 'completed' ? '今晚已修复 1 个卡点' : '',
    reportAction && reportAction.ready ? reportAction.actionLine : '',
    evidenceBrief && evidenceBrief.reportLine ? evidenceBrief.reportLine : ''
  ].filter(Boolean).join(' · ') || '先从今晚第一步开始沉淀记录';
  const capabilityLine = nextCapability ? `能力账本下一条：${nextCapability.label} · ${nextCapability.nextAction}` : '';
  const subjectDepthLine = subjectSkillDepth && subjectSkillDepth.label
    ? `${subjectSkillDepth.label}：${subjectSkillDepth.firstStep}`
    : '';
  return {
    code,
    title,
    subtitle: todayFocus && todayFocus.title
      ? `当前重点：${todayFocus.title} · ${todayFocus.repairStatus === 'completed' ? '已完成今日修复' : '今晚继续修'}`
      : total
      ? `${total} 张真实学习卡 · 今日复习 ${reviewedToday} 张 · ${repaired} 个卡点记录`
      : '先完成一次真实学习记录，再整理今天的复盘卡。',
    badge: streak >= 7 ? '7天连续回访' : streak >= 3 ? '连续回访中' : '今日复盘',
    identityTag,
    inviteCode: code,
    levelText: level.level ? `Lv.${level.level} ${level.title || ''}` : `Lv.${safeNumber(progress.level, 1)}`,
    achievementText: game.achievementText || '完成复习后获得徽章',
    stats: [
      { id: 'xp', label: '回访', value: xp },
      { id: 'streak', label: '连续天', value: streak },
      { id: 'cards', label: '学习卡', value: total },
      { id: 'repair', label: '卡点', value: repaired }
    ],
    proofChips: [
      { id: 'today', label: '今日回访', value: `${reviewedToday} 张` },
      { id: 'due', label: '待回访', value: `${due} 张` },
      { id: 'mastered', label: '已掌握', value: `${mastered} 张` }
    ],
    parentConversationPlan: {
      open: todayFocus && todayFocus.childArticulatedStep ? `刚才你说的第一步是：${todayFocus.childArticulatedStep}` : '刚才你第一步先看了哪里？',
      follow: todayFocus && todayFocus.title ? `这处卡点下次先检查什么？` : '明天回访时先看哪一张卡？',
      avoid: '不直接讲答案，不追问排名，只确认孩子能不能说出第一步。'
    },
    shareOutcome: {
      nextAction: repaired > 0 ? '明天先回看这张错因卡' : due > 0 ? '明天先清一张待回访卡' : '明天继续说出第一步',
      evidenceRequired: ['parent_question_used', 'child_first_step', 'next_day_revisit']
    },
    shareChallengePlan,
    openMaicDecisionBridge,
    socraticMemoryRelay,
    tonightDecisionRelay,
    questionBankShareRelayDeck,
    questionBankVisualShareRelayDeck,
    familyActionCard: {
      title: '家庭行动卡',
      judgement: todayFocus && todayFocus.repairStatus === 'completed'
        ? `今天不是多刷题，而是修掉了一个真实卡点：${actionFocus}。`
        : `今晚先不扩范围，只抓一个动作：${actionFocus}。`,
      tonightAction,
      parentQuestion: oneQuestion,
      tomorrowCheck,
      evidenceLine,
      capabilityLine,
      subjectDepthLine,
      boundary: '家长只追问，不接管答案；孩子说不出第一步，就回到提示卡。'
    },
    subjectSkillDepth: subjectSkillDepth ? {
      taskType: subjectSkillDepth.taskType,
      label: subjectSkillDepth.label,
      firstStep: subjectSkillDepth.firstStep,
      parentQuestion: subjectSkillDepth.parentQuestion,
      reportSignal: subjectSkillDepth.reportSignal,
      shareLine: subjectSkillDepth.shareLine,
      evidenceRequired: subjectSkillDepth.evidenceRequired || []
    } : null,
    curriculumSpine: curriculumSpine ? {
      subjectLabel: curriculumSpine.subjectLabel,
      title: curriculumSpine.title,
      reportLine: curriculumSpine.reportLine,
      parentDecisionLine: curriculumSpine.parentDecisionLine,
      shareLine: curriculumSpine.shareLine,
      visualBoardLine: curriculumSpine.visualBoardLine,
      progression: curriculumSpine.progression || []
    } : null,
    visualSocraticMatrix: visualSocraticMatrix ? {
      title: visualSocraticMatrix.title,
      visualBoundary: visualSocraticMatrix.visualBoundary,
      parentLine: visualSocraticMatrix.parentLine,
      reportLine: visualSocraticMatrix.reportLine,
      boardMoves: visualSocraticMatrix.boardMoves || [],
      socraticQuestions: visualSocraticMatrix.socraticQuestions || []
    } : null,
    courseUnitDecision,
    capabilityGap: nextCapability ? {
      id: nextCapability.id,
      label: nextCapability.label,
      route: nextCapability.route,
      evidenceLine: nextCapability.evidenceLine,
      nextAction: nextCapability.nextAction,
      ledgerLine: capabilityLedger.parentLine || capabilityLedger.summary || ''
    } : null,
    reportDailyAction: reportAction,
    globalEvidenceBrief: evidenceBrief,
    capabilityEvidenceLedger: capabilityLedger,
    unifiedNextAction: unifiedAction,
    path,
    parentPath,
    peerPath,
    parentShareTitle,
    peerShareTitle,
    shareIntents: [
      { id: 'parent_card', label: '发给家长看', path: parentPath, title: parentShareTitle },
      { id: 'peer_challenge', label: '继续轻回访', path: peerPath, title: peerShareTitle }
    ],
    inviteLine: `复盘码 ${code}：记录今天的 5 分钟轻回访；不排行，只看有没有说清第一步。`,
    shareButton: total ? '发给家长看' : '整理复盘卡',
    shareArchiveLabel: shareCount ? `本机已沉淀 ${shareCount} 条分享记录` : '首次分享会记录在本机，后续可接多设备连续性',
    payload: {
      identity_tag: identityTag,
      today_focus: todayFocus && todayFocus.title,
      today_focus_status: todayFocus && todayFocus.repairStatus,
      xp,
      streak,
      total_cards: total,
      reviewed_today: reviewedToday,
      wrong_cause_records: repaired,
      family_action_card: true,
      action_focus: actionFocus,
      parent_question: oneQuestion,
      tonight_action: tonightAction,
      tomorrow_check: tomorrowCheck,
      report_daily_action: reportAction && reportAction.actionLine,
      unified_next_action: unifiedAction && unifiedAction.actionLabel,
      unified_next_action_source: unifiedAction && unifiedAction.source,
      unified_next_action_route: unifiedAction && unifiedAction.route,
      invite_code: code,
      share_code: code,
      share_variant: shareVariant,
      proof_type: shareVariant,
      parent_next_action: parentNextAction,
      next_challenge: 'arcade',
      parent_card: true,
      peer_challenge: true,
      share_challenge_goal: shareChallengePlan && shareChallengePlan.goal,
      share_challenge_rule: shareChallengePlan && shareChallengePlan.successRule,
      share_challenge_route: shareChallengePlan && shareChallengePlan.route,
      share_privacy_boundary: shareChallengePlan && shareChallengePlan.privacyBoundary,
      share_return_contract: shareChallengePlan && shareChallengePlan.evidenceContractLine,
      share_relay_actions: shareChallengePlan && shareChallengePlan.shareRelayActions,
      safe_relay_packet: shareChallengePlan && shareChallengePlan.safeRelayChallengePacket,
      safe_relay_allowed_fields: shareChallengePlan && shareChallengePlan.safeRelayChallengePacket && shareChallengePlan.safeRelayChallengePacket.allowedFields,
      safe_relay_blocked_fields: shareChallengePlan && shareChallengePlan.safeRelayChallengePacket && shareChallengePlan.safeRelayChallengePacket.blockedFields,
      share_spread_readiness_gate: shareChallengePlan && shareChallengePlan.spreadReadinessGate,
      openmaic_bridge_status: openMaicDecisionBridge && (openMaicDecisionBridge.status || openMaicDecisionBridge.id),
      openmaic_next_action: openMaicDecisionBridge && openMaicDecisionBridge.nextAction,
      openmaic_share_boundary: openMaicDecisionBridge && openMaicDecisionBridge.shareBoundary,
      openmaic_game_gate: openMaicDecisionBridge && openMaicDecisionBridge.gameReturnEvidence && openMaicDecisionBridge.gameReturnEvidence.rewardGate,
      openmaic_blocked_fields: openMaicDecisionBridge && openMaicDecisionBridge.shareRelayPayload && openMaicDecisionBridge.shareRelayPayload.blockedFields,
      openmaic_evidence: openMaicDecisionBridge && Array.isArray(openMaicDecisionBridge.evidenceList) ? openMaicDecisionBridge.evidenceList.slice(0, 3).join(' / ') : '',
      openmaic_return_path: openMaicDecisionBridge && openMaicDecisionBridge.shareRelayPayload && openMaicDecisionBridge.shareRelayPayload.path,
      socratic_report_status: socraticMemoryRelay && socraticMemoryRelay.status,
      socratic_report_action: socraticMemoryRelay && socraticMemoryRelay.action,
      socratic_report_decision: socraticMemoryRelay && socraticMemoryRelay.decision,
      socratic_report_no_increase: socraticMemoryRelay && socraticMemoryRelay.noIncreaseRule,
      socratic_report_boundary: socraticMemoryRelay && socraticMemoryRelay.shareBoundary,
      tonight_decision_title: tonightDecisionRelay && tonightDecisionRelay.title,
      tonight_decision_headline: tonightDecisionRelay && tonightDecisionRelay.headline,
      tonight_parent_question: tonightDecisionRelay && tonightDecisionRelay.parentQuestion,
      tonight_tomorrow_revisit: tonightDecisionRelay && tonightDecisionRelay.tomorrow,
      tonight_release_gate: tonightDecisionRelay && tonightDecisionRelay.releaseGate,
      tonight_share_boundary: tonightDecisionRelay && tonightDecisionRelay.shareLine,
      tonight_allowed_fields: tonightDecisionRelay && tonightDecisionRelay.allowedFields,
      tonight_blocked_fields: tonightDecisionRelay && tonightDecisionRelay.blockedFields,
      question_bank_relay_label: activeRelayCard && activeRelayCard.label,
      question_bank_relay_first_step: activeRelayCard && activeRelayCard.firstStep,
      question_bank_relay_parent_check: activeRelayCard && activeRelayCard.parentCheck,
      question_bank_relay_route: activeRelayCard && activeRelayCard.route,
      question_bank_relay_boundary: questionBankShareRelayDeck && questionBankShareRelayDeck.shareLine,
      question_bank_relay_allowed_fields: questionBankShareRelayDeck && questionBankShareRelayDeck.safeSharePayload && questionBankShareRelayDeck.safeSharePayload.allowed_fields,
      question_bank_relay_blocked_fields: questionBankShareRelayDeck && questionBankShareRelayDeck.safeSharePayload && questionBankShareRelayDeck.safeSharePayload.blocked_fields,
      visual_board_relay_title: questionBankVisualShareRelayDeck && questionBankVisualShareRelayDeck.safeQuery && questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_title,
      visual_board_relay_layer: questionBankVisualShareRelayDeck && questionBankVisualShareRelayDeck.safeQuery && questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_layer,
      visual_board_relay_student_line: questionBankVisualShareRelayDeck && questionBankVisualShareRelayDeck.safeQuery && questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_student_line,
      visual_board_relay_parent_line: questionBankVisualShareRelayDeck && questionBankVisualShareRelayDeck.safeQuery && questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_parent_line,
      visual_board_relay_exit: questionBankVisualShareRelayDeck && questionBankVisualShareRelayDeck.safeQuery && questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_exit,
      visual_board_relay_route: questionBankVisualShareRelayDeck && questionBankVisualShareRelayDeck.safeQuery && questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_route,
      visual_board_relay_boundary: questionBankVisualShareRelayDeck && questionBankVisualShareRelayDeck.safeQuery && questionBankVisualShareRelayDeck.safeQuery.visual_board_relay_boundary,
      visual_board_relay_allowed_fields: questionBankVisualShareRelayDeck && questionBankVisualShareRelayDeck.allowedFields,
      visual_board_relay_blocked_fields: questionBankVisualShareRelayDeck && questionBankVisualShareRelayDeck.blockedFields,
      evidence_brief: evidenceBrief && evidenceBrief.reportLine,
      capability_gap_id: nextCapability && nextCapability.id,
      capability_gap_label: nextCapability && nextCapability.label,
      capability_gap_route: nextCapability && nextCapability.route,
      capability_gap_next_action: nextCapability && nextCapability.nextAction,
      subject_depth_task_type: subjectSkillDepth && subjectSkillDepth.taskType,
      subject_depth_label: subjectSkillDepth && subjectSkillDepth.label,
      subject_depth_first_step: subjectSkillDepth && subjectSkillDepth.firstStep,
      curriculum_subject: curriculumSpine && curriculumSpine.subjectLabel,
      curriculum_current_node: curriculumSpine && curriculumSpine.currentNode && curriculumSpine.currentNode.label,
      visual_socratic_subject: visualSocraticMatrix && visualSocraticMatrix.subjectLabel,
      course_unit_label: courseUnitDecision && courseUnitDecision.unitLabel,
      course_unit_subject: courseUnitDecision && courseUnitDecision.subjectLabel,
      course_unit_tier: courseUnitDecision && courseUnitDecision.tier,
      course_unit_parent_decision: courseUnitDecision && courseUnitDecision.parentTonightDecision,
      course_unit_report_contract: courseUnitDecision && courseUnitDecision.reportContract,
      course_unit_share_contract: courseUnitDecision && courseUnitDecision.shareContract,
      course_unit_blackboard: courseUnitDecision && courseUnitDecision.blackboardLine,
      course_unit_recall_route: courseUnitDecision && courseUnitDecision.recallRoute,
      course_unit_game_route: courseUnitDecision && courseUnitDecision.gameRoute,
      mode: 'same_identity',
      challenge: 'arcade'
    }
  };
}

function resolveShareIntent(card, intent) {
  const current = intent || 'peer_challenge';
  if (current === 'parent_card') {
    const payload = buildSafeSharePayload(card, 'parent_card', {
      share_intent: 'parent_card',
      from: 'parent_card',
      mode: 'parent_recap'
    });
    return {
      share_intent: 'parent_card',
      title: card.parentShareTitle || card.title || '给家里看的今日学习复盘',
      path: buildSchemaSharePath(payload),
      payload
    };
  }
  const payload = buildSafeSharePayload(card, 'peer_challenge', {
    share_intent: 'peer_challenge',
    from: 'peer_challenge',
    mode: 'same_identity',
    challenge: 'arcade'
  });
  return {
    share_intent: 'peer_challenge',
    title: card.peerShareTitle || card.title || '来和我一起回访今天的一小步',
    path: buildSchemaSharePath(payload),
    payload
  };
}

function buildSchemaSharePath(payload = {}) {
  return shareRelaySchema.buildShareRelayQuery('/pages/home/home', payload);
}

function buildSafeSharePayload(card = {}, intent = 'peer_challenge', extra = {}) {
  return shareRelaySchema.buildSafeSharePayload(card, intent, extra);
  const source = Object.assign({}, card.payload || {}, extra || {});
  const allowlist = [
    'share_intent',
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
    'relay_first_step',
    'relay_receiver_action',
    'relay_parent_check',
    'relay_next_revisit',
    'relay_allowed_fields',
    'relay_blocked_fields',
    'relay_completion_signal',
    'relay_return_path',
    'tonight_parent_question',
    'tonight_tomorrow_revisit',
    'tonight_release_gate',
    'tonight_share_boundary',
    'tonight_allowed_fields',
    'tonight_blocked_fields',
    'question_bank_relay_first_step',
    'question_bank_relay_wrong_cause',
    'question_bank_relay_next_action',
    'course_unit_parent_decision',
    'course_unit_share_contract',
    'course_unit_recall_route',
    'course_unit_game_route',
    'relay_review',
    'relay_spread_status',
    'relay_season_status',
    'wrong_cause_label',
    'wrong_cause_first_step',
    'wrong_cause_parent_check',
    'wrong_cause_receiver_action',
    'wrong_cause_next_revisit',
    'wrong_cause_allowed_fields',
    'wrong_cause_blocked_fields',
    'source_challenge_route',
    'openmaic_bridge_status',
    'openmaic_next_action',
    'openmaic_share_boundary',
    'openmaic_game_gate',
    'openmaic_blocked_fields',
    'openmaic_evidence',
    'openmaic_return_path'
  ];
  const denylist = [
    'original_question',
    'original_answer',
    'photo',
    'raw_text',
    'full_answer',
    'full_solution',
    'full_dialogue',
    'score',
    'ranking',
    'private_comment',
    'classmate_comparison',
    'teacher_private_comment',
    'complete_transcript'
  ];
  const safe = {
    share_intent: intent,
    share_code: card.code || source.share_code || source.invite_code || 'LOCAL',
    allowed_fields: ['share_code', 'tonight_action', 'parent_question', 'tomorrow_check', 'safe_relay_allowed_fields'],
    blocked_fields: denylist
  };
  allowlist.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key) && !denylist.includes(key)) {
      safe[key] = source[key];
    }
  });
  safe.sanitized = true;
  safe.local_rule = '分享出口只走白名单，本地代码剔除原题、答案、照片、完整对话、分数、排名和私密评论。';
  return safe;
}

function buildProfileSafeSummary(todayFocus, focusHistory = [], profileEmptyGuide = '') {
  const todaySession = storage.getTodaySession ? storage.getTodaySession() : null;
  const realSummary = storage.buildRecentLearningSummary ? storage.buildRecentLearningSummary() : null;
  const latestSession = focusHistory[0] || null;
  const reviewCardsForFocus = storage.loadReviewCards
    ? storage.loadReviewCards().filter((card) => card && (!todayFocus || card.sourceFocusId === todayFocus.id || card.source === 'today_focus'))
    : [];
  const reviewEventsForFocus = storage.loadReviewEvents
    ? storage.loadReviewEvents().filter((event) => event && (!todayFocus || event.sourceFocusId === todayFocus.id || event.focusId === todayFocus.id || event.source === 'today_focus'))
    : [];
  const childStep = String(
    (todaySession && todaySession.childArticulatedStep)
    || (todayFocus && (todayFocus.childArticulatedStep || todayFocus.childStepSentence || todayFocus.title))
    || (latestSession && (latestSession.linkedChildArticulatedStep || latestSession.linkedSystemSuggestedStep || latestSession.focusEvidenceText))
    || ''
  ).trim();
  const systemStep = String(
    (todaySession && todaySession.systemSuggestedStep)
    || (todayFocus && (todayFocus.systemSuggestedStep || todayFocus.miniActionText || todayFocus.recommendation))
    || (latestSession && latestSession.linkedSystemSuggestedStep)
    || ''
  ).trim();
  const stuckPoint = String(
    (todaySession && todaySession.stuckPointText)
    || (todayFocus && (todayFocus.stuckPointText || todayFocus.sourceText || todayFocus.title))
    || (latestSession && latestSession.linkedStuckPointText)
    || ''
  ).trim();
  const firstStepLine = childStep
    ? `孩子已经说出第一步：${childStep}`
    : systemStep
      ? `今晚先从这里开始：${systemStep}`
      : '今晚先让孩子说出“我第一步准备看哪里”。';
  const nextReviewCard = reviewCardsForFocus[0] || null;
  const reviewEvidenceCount = reviewEventsForFocus.length;
  const tomorrowRevisit = nextReviewCard && (nextReviewCard.front || nextReviewCard.title)
    ? `明天先回看这张卡：${nextReviewCard.front || nextReviewCard.title}`
    : reviewEvidenceCount
      ? '明天换一道同类小题，只确认第一步还会不会卡。'
      : '明天只用 3 分钟回访：让孩子复述今天这一步。';
  const evidenceBoundaryLine = [
    childStep ? '孩子原话' : '',
    systemStep ? '建议第一步' : '',
    reviewCardsForFocus.length ? '复习卡' : '',
    reviewEvidenceCount ? '回访记录' : ''
  ].filter(Boolean).join(' / ') || '本机暂未积累足够证据';
  const parentActionChecklist = [
    { id: 'listen', label: '先听', text: stuckPoint || childStep || '孩子今晚卡在哪里' },
    { id: 'ask', label: '只问', text: storage.parentQuestionFromFirstStep ? storage.parentQuestionFromFirstStep(childStep || systemStep) : '你第一步先做了什么？' },
    { id: 'revisit', label: '明天', text: tomorrowRevisit }
  ];
  const days = focusHistory
    .slice(0, 7)
    .map((item) => String(item.completedAt || item.interruptedAt || item.startedAt || '').slice(0, 10))
    .filter(Boolean);
  const uniqueDays = Array.from(new Set(days)).length;
  return {
    isEmpty: !(childStep || stuckPoint || uniqueDays),
    stuckLine: stuckPoint || childStep || '今晚还没有记录。先让孩子说出自己的第一步。',
    parentQuestion: storage.parentQuestionFromFirstStep ? storage.parentQuestionFromFirstStep(childStep) : '你第一步先做了什么？',
    firstStepLine,
    tomorrowRevisit,
    evidenceBoundaryLine: `证据来自：${evidenceBoundaryLine}。不展示完整对话，不给答案，不看排名。`,
    confidenceLabel: uniqueDays >= 7 ? '7 晚较稳' : uniqueDays >= 3 ? '模式形成中' : '只看今晚',
    parentActionChecklist,
    threeNightSummary: realSummary && realSummary.threeNightText ? realSummary.threeNightText : '',
    sevenNightSummary: realSummary && realSummary.sevenNightText ? realSummary.sevenNightText : '',
    realDays: realSummary && realSummary.latest7 ? realSummary.latest7 : [],
    weeklySummary: realSummary && realSummary.latest7 && realSummary.latest7.length >= 7
      ? realSummary.sevenNightText
      : '用满 7 晚后，咕点再整理一条更稳的复盘线索。',
    recentSummary: uniqueDays
      ? `最近 ${uniqueDays} 晚留下过第一步或专注记录。`
      : (profileEmptyGuide || '再用两晚后，咕点会帮你看见模式。')
  };
}

function buildCourseUnitDecisionBoard(courseUnitMap = null) {
  const active = courseUnitMap && courseUnitMap.active ? courseUnitMap.active : null;
  const units = active && Array.isArray(active.units) ? active.units : [];
  const unit = units[0] || null;
  if (!courseUnitMap || !active || !unit) return null;
  return {
    title: `${active.label}单元级家庭决策板`,
    summary: `当前先看「${unit.unitLabel}」这一单元，不按分数下结论，按第一步、错因和隔天回访下结论。`,
    unitLabel: unit.unitLabel,
    subjectLabel: unit.subjectLabel,
    tier: unit.tier,
    gradeBand: unit.gradeBand,
    questionTypes: unit.reusableQuestionTypes || [],
    wrongCauseAtlas: unit.wrongCauseAtlas || [],
    diagnosticProbes: unit.diagnosticProbes || [],
    blackboardLine: unit.blackboardBlueprint ? `${unit.blackboardBlueprint.title}：${unit.blackboardBlueprint.firstStroke}` : '',
    parentTonightDecision: `今晚只判断一件事：孩子能不能自己说出「${unit.unitLabel}」的第一步和一个错因。`,
    classroomObservationLine: `课堂级观察：同类题是否还卡在「${unit.wrongCauseAtlas && unit.wrongCauseAtlas[0] ? unit.wrongCauseAtlas[0] : '第一步'}」。`,
    sevenDayReviewLine: unit.practiceLoop && unit.practiceLoop.nextDay ? unit.practiceLoop.nextDay : '第 7 天用一道同类小变式复核。',
    reportContract: unit.reportContract,
    shareContract: unit.shareContract,
    actionRoute: unit.route || '/pages/tutor/tutor',
    recallRoute: unit.recallRoute || '/pages/review/review',
    gameRoute: unit.gameRoute || '/pages/arcade/arcade',
    evidenceRequired: unit.evidenceRequired || []
  };
}

function buildFamilyDecisionHomepage(input = {}) {
  const familyDecisionMemo = input.familyDecisionMemo || {};
  const tonightDecisionBrief = input.tonightDecisionBrief || {};
  const reportEvidenceReleaseGate = input.reportEvidenceReleaseGate || {};
  const sourceEvidenceLedger = input.sourceEvidenceLedger || {};
  const reportDailyActionQueue = input.reportDailyActionQueue || {};
  const familyDecisionActionBridge = input.familyDecisionActionBridge || {};
  const homeSchoolCollaborationDigest = input.homeSchoolCollaborationDigest || {};
  const parentDecisionBook = input.parentDecisionBook || {};
  const parentReflectionSummary = input.parentReflectionSummary || {};
  const active = reportDailyActionQueue.active || {};
  const sourceLanes = Array.isArray(sourceEvidenceLedger.lanes) ? sourceEvidenceLedger.lanes : [];
  const primarySource = sourceLanes.find((item) => item && item.status === 'hit') || sourceLanes[0] || {};
  const doList = Array.isArray(tonightDecisionBrief.tonightDo) && tonightDecisionBrief.tonightDo.length
    ? tonightDecisionBrief.tonightDo.slice(0, 3)
    : [familyDecisionMemo.tonightDecision || active.task || '今晚只做一个第一步动作'];
  const dontList = Array.isArray(tonightDecisionBrief.tonightDoNot) && tonightDecisionBrief.tonightDoNot.length
    ? tonightDecisionBrief.tonightDoNot.slice(0, 3)
    : (Array.isArray(familyDecisionMemo.doNotDo) ? familyDecisionMemo.doNotDo.slice(0, 3) : []);
  const evidenceList = Array.isArray(tonightDecisionBrief.evidenceChecklist) && tonightDecisionBrief.evidenceChecklist.length
    ? tonightDecisionBrief.evidenceChecklist.slice(0, 4)
    : (Array.isArray(familyDecisionMemo.evidenceChecklist) ? familyDecisionMemo.evidenceChecklist.slice(0, 4) : []);
  const blocked = reportEvidenceReleaseGate.homeSchoolSafeHandoff && Array.isArray(reportEvidenceReleaseGate.homeSchoolSafeHandoff.blockedFields)
    ? reportEvidenceReleaseGate.homeSchoolSafeHandoff.blockedFields
    : ['original_question', 'full_answer', 'score', 'ranking'];
  const allowed = reportEvidenceReleaseGate.homeSchoolSafeHandoff && Array.isArray(reportEvidenceReleaseGate.homeSchoolSafeHandoff.allowedFields)
    ? reportEvidenceReleaseGate.homeSchoolSafeHandoff.allowedFields
    : ['tonight_action', 'first_step_observation', 'parent_question'];
  const releaseDecision = reportEvidenceReleaseGate.releaseDecision || 'collect_more_evidence';
  const portraitStatus = releaseDecision === 'home_school_safe_handoff'
    ? '可安全交接'
    : releaseDecision === 'tonight_action_only'
      ? '只放行今晚动作'
      : '继续收证据';
  const actualLongitudinalEvidence = reportEvidenceReleaseGate.actualLongitudinalEvidence || {};
  const statusSteps = [
    {
      id: 'tonight_action',
      label: '今晚动作',
      status: doList.length ? 'ready' : 'missing',
      line: doList[0] || '先补一个第一步动作'
    },
    {
      id: 'next_day_revisit',
      label: '明天回访',
      status: actualLongitudinalEvidence.nextDayRevisitCount > 0 ? 'ready' : 'pending',
      line: actualLongitudinalEvidence.nextDayRevisitCount > 0 ? `已有 ${actualLongitudinalEvidence.nextDayRevisitCount} 次回访证据` : '还需要明天换一题回访'
    },
    {
      id: 'day7_variant',
      label: '第7天变式',
      status: actualLongitudinalEvidence.day7VariantReady ? 'ready' : 'locked',
      line: actualLongitudinalEvidence.day7VariantReady ? '第7天迁移证据已就绪' : '未到第7天前不写长期画像'
    },
    {
      id: 'parent_receipt',
      label: '家长回执',
      status: parentReflectionSummary.ready ? 'ready' : 'pending',
      line: parentReflectionSummary.line || '家长看完报告后，还需要留下是否只问一句、孩子是否能复述的回执。'
    },
    {
      id: 'safe_share',
      label: '安全分享',
      status: allowed.length && blocked.length ? 'ready' : 'locked',
      line: '只带动作、证据缺口和回访时间'
    }
  ];
  const missingSteps = statusSteps.filter((step) => step.status !== 'ready');
  return {
    id: 'family_decision_homepage',
    title: '家庭决策书首页',
    headline: tonightDecisionBrief.headline || familyDecisionMemo.tonightDecision || active.task || '今晚先把一个第一步做稳',
    status: portraitStatus,
    statusLevel: releaseDecision === 'home_school_safe_handoff' ? 'ready' : releaseDecision === 'tonight_action_only' ? 'action' : 'locked',
    statusSteps,
    primaryBlocker: missingSteps[0] ? missingSteps[0].line : '',
    evidenceMissingCount: missingSteps.length,
    nextLocalAction: parentDecisionBook.tomorrowCheck || active.checkpoint || '明天换一题回访同一第一步。',
    safeShareBadges: [
      `可带 ${allowed.slice(0, 3).join('/')}`,
      `不带 ${blocked.slice(0, 3).join('/')}`
    ],
    primaryAction: active.task || familyDecisionActionBridge.summary || familyDecisionMemo.tonightDecision || '',
    parentQuestion: tonightDecisionBrief.parentScript || homeSchoolCollaborationDigest.parentQuestion || familyDecisionActionBridge.parentPrompt || '',
    childLine: tonightDecisionBrief.childScript || '我先说出第一步，不直接要答案。',
    tomorrow: tonightDecisionBrief.tomorrowRevisit || active.checkpoint || '',
    sourceLine: primarySource.label
      ? `${primarySource.label}：${primarySource.canProduce || primarySource.status || '只进入证据账本'}`
      : '来源还不足，先补孩子第一步或错因文字。',
    localAiSplitLine: '本地代码决定来源、放行、画像、分享字段；AI 只改写追问和家长解释。',
    homeSchoolLine: homeSchoolCollaborationDigest.suggestedMessage || reportEvidenceReleaseGate.summary || '',
    shareBoundary: tonightDecisionBrief.shareLine || familyDecisionMemo.shareLine || '分享只带行动和证据，不带原题、答案、分数、排名或完整对话。',
    doList,
    dontList,
    evidenceList,
    allowedFields: allowed.slice(0, 6),
    blockedFields: blocked.slice(0, 8),
    parentReceiptLine: parentReflectionSummary.line || '',
    parentReceiptReady: !!parentReflectionSummary.ready,
    parentReceiptStats: {
      total: Number(parentReflectionSummary.total || 0),
      askedOneQuestion: Number(parentReflectionSummary.askedOneQuestion || 0),
      childRecalledFirstStep: Number(parentReflectionSummary.childRecalledFirstStep || 0),
      nextDayRevisit: Number(parentReflectionSummary.nextDayRevisit || 0),
      directAnswerCount: Number(parentReflectionSummary.directAnswerCount || 0)
    },
    route: active.route || familyDecisionActionBridge.primaryRoute || '/pages/tutor/tutor?from=family_decision_homepage',
    ctaLabel: active.task ? '去完成今日动作' : '先补第一步证据',
    ready: !!(doList.length && evidenceList.length)
  };
}

function buildTonightParentDecisionCard(input = {}) {
  const familyDecisionHomepage = input.familyDecisionHomepage || {};
  const tonightDecisionBrief = input.tonightDecisionBrief || {};
  const familyDecisionMemo = input.familyDecisionMemo || {};
  const reportDailyActionQueue = input.reportDailyActionQueue || {};
  const active = reportDailyActionQueue.active || {};
  const doList = Array.isArray(familyDecisionHomepage.doList) ? familyDecisionHomepage.doList : [];
  const evidenceList = Array.isArray(familyDecisionHomepage.evidenceList) ? familyDecisionHomepage.evidenceList : [];
  const firstAction = familyDecisionHomepage.primaryAction
    || active.task
    || doList[0]
    || familyDecisionMemo.tonightDecision
    || '今晚只做一个第一步动作';
  const childFirstStep = familyDecisionHomepage.childLine
    || tonightDecisionBrief.childScript
    || '孩子只需要说出第一步，不需要一次讲完整过程。';
  const parentQuestion = familyDecisionHomepage.parentQuestion
    || tonightDecisionBrief.parentScript
    || '你第一步准备先看哪里？';
  const tomorrowCheck = familyDecisionHomepage.tomorrow
    || tonightDecisionBrief.tomorrowRevisit
    || active.checkpoint
    || '明天换一题，只回访同一个第一步。';
  return {
    id: 'tonight_parent_decision_card',
    title: '今晚四行决策卡',
    subtitle: '先看这一张，再决定要不要展开完整报告。',
    firstAction,
    childFirstStep,
    parentQuestion,
    tomorrowCheck,
    evidenceLine: evidenceList.length
      ? `依据：${evidenceList.slice(0, 3).join(' / ')}`
      : familyDecisionHomepage.sourceLine || '依据不足时，只放行今晚动作，不写长期画像。',
    safetyLine: familyDecisionHomepage.shareBoundary || '不带原题、答案、完整对话、分数或排名。',
    route: familyDecisionHomepage.route || active.route || '/pages/tutor/tutor?from=tonight_parent_decision_card',
    ctaLabel: familyDecisionHomepage.ctaLabel || (active.task ? '去完成今日动作' : '先补第一步证据'),
    rows: [
      { id: 'do', label: '今晚先做', text: firstAction },
      { id: 'child', label: '孩子第一步', text: childFirstStep },
      { id: 'parent', label: '家长只问', text: parentQuestion },
      { id: 'tomorrow', label: '明天回访', text: tomorrowCheck }
    ],
    ready: !!(firstAction && parentQuestion && tomorrowCheck)
  };
}

function partnerStatusLine(status) {
  const map = {
    needs_real_task_evidence: '待补真实作业证据：只可解释报告，不进入服务交付。',
    needs_parent_confirmation: '待家长确认：已有证据，但合作交付前必须确认范围。',
    ready_for_guarded_delivery: '可进入受保护交付：只交付行动、问题和下一条证据。'
  };
  return map[status] || '待确认交付状态：先补证据和家长确认。';
}

function partnerFieldLabel(field) {
  const map = {
    child_code: '匿名孩子编号',
    grade_band: '学段',
    evidence_stage: '证据阶段',
    primary_mode: '建议学习模式',
    primary_package: '服务包候选',
    next_action: '下一步动作',
    parent_confirmation_status: '家长确认状态',
    followup_due_day: '回访日',
    full_answer: '完整答案',
    full_solution: '完整解法',
    original_question: '原题',
    raw_text: '原始材料',
    photo: '照片',
    score_ranking: '分数/排名解释',
    talent_label: '天赋定性标签',
    guaranteed_result: '提分或结果承诺',
    child_name: '孩子姓名',
    parent_phone: '家长手机号',
    parent_wechat: '家长微信',
    contact_info: '联系方式'
  };
  return map[field] || String(field || '').replace(/_/g, ' ');
}

function formatPartnerFieldList(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .map(partnerFieldLabel)
    .filter(Boolean)
    .join('、');
}

function pilotStatusLine(checklist = {}) {
  if (!checklist) return '';
  if (checklist.status === 'ready_for_partner_pilot') return '试点就绪：可以从一个7天家庭执行闭环开始。';
  return '试点待补证据：先补材料、真实作业证据或家长确认。';
}

function formatPartnerPilotRows(rows = []) {
  const labelMap = {
    material_intake: '材料已接收',
    real_task_evidence: '真实作业证据',
    parent_confirmation: '家长确认',
    safe_partner_view: '合作方安全视图',
    executable_family_plan: '可执行家庭方案'
  };
  return (Array.isArray(rows) ? rows : []).map((item) => ({
    id: item.id,
    label: labelMap[item.id] || item.label || item.id,
    readyText: item.ready ? '已就绪' : '待补证据',
    nextAction: item.nextAction || ''
  }));
}

function formatPartnerDeliveryRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((item) => ({
    id: item.id,
    label: item.label || item.id,
    owner: item.owner || '',
    action: item.action || '',
    releaseGate: item.releaseGate || ''
  }));
}

function formatRevenueMilestones(rows = []) {
  const labelMap = {
    free_interpretation: '免费报告解读',
    paid_7_day_execution: '7天陪跑服务',
    course_or_counselor_upgrade: '课程/顾问升级'
  };
  return (Array.isArray(rows) ? rows : []).map((item) => ({
    id: item.id,
    label: labelMap[item.id] || item.id,
    statusText: item.allowed ? '可进入' : '未放行',
    gate: item.gate || ''
  }));
}

function buildPartnerServiceReviewCard(partnerWorkbench = null, servicePathway = null, revisitEvidence = null) {
  if (!partnerWorkbench) return null;
  const revenueRows = Array.isArray(partnerWorkbench.revenueMilestones) ? partnerWorkbench.revenueMilestones : [];
  const paid7Day = revenueRows.find((item) => item.id === 'paid_7_day_execution') || {};
  const counselorUpgrade = revenueRows.find((item) => item.id === 'course_or_counselor_upgrade') || {};
  const advisorNext = Array.isArray(partnerWorkbench.advisorQueue)
    ? (partnerWorkbench.advisorQueue.find((item) => item.status === 'todo') || partnerWorkbench.advisorQueue[0] || {})
    : {};
  const validationPlan = servicePathway && Array.isArray(servicePathway.validationPlan) ? servicePathway.validationPlan : [];
  const day7Ready = !!(revisitEvidence && revisitEvidence.day7VariantReady);
  const canStartPaidLoop = !!paid7Day.allowed;
  const canReviewUpgrade = !!(day7Ready && counselorUpgrade.allowed);
  const stage = !canStartPaidLoop
    ? 'need_evidence'
    : canReviewUpgrade
      ? 'ready_for_review'
      : 'run_7_day_loop';
  return {
    id: 'partner_service_review_card',
    title: stage === 'need_evidence'
      ? '下一次服务：先补证据'
      : stage === 'ready_for_review'
        ? '下一次服务：安排顾问复盘'
        : '下一次服务：启动 7 天陪跑',
    statusLine: stage === 'need_evidence'
      ? '当前只适合做报告解读或补材料，不从测评标签直接销售服务包。'
      : stage === 'ready_for_review'
        ? '第 7 天小变式和家长确认已满足，可以整理一次顾问复盘建议。'
        : '真实作业证据和家长确认已具备，可以进入受保护的 7 天执行闭环。',
    decisionLine: stage === 'ready_for_review'
      ? '复盘只判断保留、降级或更换学习方法，不承诺提分。'
      : stage === 'run_7_day_loop'
        ? '先跑 7 天：今晚动作、隔天回访、第 7 天小变式，再决定是否升级。'
        : '先补真实错题、孩子第一步、隔天回访或家长确认，再讨论服务。',
    evidenceLine: validationPlan.length
      ? `已准备 ${validationPlan.length} 个验证节点；第 7 天证据：${day7Ready ? '已就绪' : '未就绪'}。`
      : `第 7 天证据：${day7Ready ? '已就绪' : '未就绪'}。`,
    nextActionLine: advisorNext.action || partnerWorkbench.nextBestAction || '按证据补齐情况决定下一步。',
    releaseLine: '放行标准：只交付行动、问题、下一条证据和家长确认范围；不交付原题、完整答案、排名或天赋定性。',
    actions: [
      {
        id: 'partner_service_review_primary',
        label: stage === 'need_evidence' ? '补一条证据' : stage === 'ready_for_review' ? '申请顾问复盘' : '进入 7 天验证',
        route: stage === 'need_evidence'
          ? '/pages/upload/upload?from=partner_service_review&type=wrong_question_paper'
          : stage === 'ready_for_review'
            ? '/pages/profile/profile?from=partner_service_review&panel=lead'
            : '/pages/review/review?from=partner_service_review&stage=day7',
        reason: stage === 'need_evidence'
          ? '补真实作业或错题证据后再进入服务建议。'
          : stage === 'ready_for_review'
            ? '把 7 天证据整理成一次顾问复盘，不承诺结果。'
            : '用 7 天执行结果决定是否升级服务。'
      },
      {
        id: 'partner_service_review_parent',
        label: '确认交付范围',
        route: '/pages/upload/upload?from=partner_service_review&type=parent_report',
        reason: '合作或顾问交付前，先由家长确认可使用范围。'
      }
    ]
  };
}

function buildLearningReportSummary(reportState = {}, capabilityEvidenceLedger, subjectSkillDepth, curriculumSpine, visualSocraticMatrix, courseUnitMap, latestThinkingReceipt = null) {
  const globalEvidenceBrief = storage.buildGlobalEvidenceBrief ? storage.buildGlobalEvidenceBrief() : null;
  const capabilityLedger = capabilityEvidenceLedger || (storage.buildCapabilityEvidenceLedger ? storage.buildCapabilityEvidenceLedger({ globalEvidenceBrief }) : null);
  const nextCapability = capabilityLedger && capabilityLedger.nextCapability ? capabilityLedger.nextCapability : null;
  const reportDailyActionQueue = storage.buildReportDailyActionQueue ? storage.buildReportDailyActionQueue({ reportState }) : null;
  const draft = reportState.reportDraft || {};
  const overview = draft.overview || {};
  const plan = draft.recommendationPlan || {};
  const solutionMap = reportState.solutionMap || draft.solutionMap || {};
  const longTermPortrait = reportState.longTermPortrait || draft.longTermPortrait || {};
  const classroomDecisionBoard = reportState.classroomDecisionBoard || draft.classroomDecisionBoard || {};
  const familyDecisionMemo = reportState.familyDecisionMemo || draft.familyDecisionMemo || {};
  const portraitConfidenceSystem = reportState.portraitConfidenceSystem || draft.portraitConfidenceSystem || {};
  const parentDecisionTrustSystem = reportState.parentDecisionTrustSystem || draft.parentDecisionTrustSystem || {};
  const longitudinalPortraitTimeline = reportState.longitudinalPortraitTimeline || draft.longitudinalPortraitTimeline || {};
  const portraitEvidenceMaturitySystem = reportState.portraitEvidenceMaturitySystem || draft.portraitEvidenceMaturitySystem || {};
  const crossWeekTrendBoard = reportState.crossWeekTrendBoard || draft.crossWeekTrendBoard || {};
  const homeSchoolCollaborationDigest = reportState.homeSchoolCollaborationDigest || draft.homeSchoolCollaborationDigest || {};
  const homeSchoolConferenceKit = reportState.homeSchoolConferenceKit || draft.homeSchoolConferenceKit || {};
  const reportEvidenceReleaseGate = reportState.reportEvidenceReleaseGate || draft.reportEvidenceReleaseGate || {};
  const sourceEvidenceLedger = reportState.sourceEvidenceLedger || draft.sourceEvidenceLedger || {};
  const uploadedMaterialDecisionDossier = reportState.uploadedMaterialDecisionDossier || draft.uploadedMaterialDecisionDossier || {};
  const uploadedMaterialReportHandoff = storage.get
    ? storage.get('upload.report.handoff.v1', null)
    : null;
  const servicePathway = reportState.servicePathway
    || draft.servicePathway
    || uploadedMaterialDecisionDossier.servicePathway
    || (uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.servicePathway)
    || null;
  const partnerWorkbench = reportState.partnerDeliveryWorkbench
    || draft.partnerDeliveryWorkbench
    || (uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.partnerDeliveryWorkbench)
    || (servicePathway ? partnerDeliveryWorkbench.buildPartnerDeliveryWorkbench({
      profile: reportState.profileBasics || draft.profileBasics || {},
      materials: [{
        id: draft.id || 'profile_report_material',
        sourceSchemaId: uploadedMaterialDecisionDossier.sourceSchemaId || 'parent_report',
        title: uploadedMaterialDecisionDossier.title || 'uploaded material',
        structuredEvidenceSignals: uploadedMaterialDecisionDossier.structuredEvidenceSignals || uploadedMaterialDecisionDossier.evidenceSignals || {}
      }],
      servicePathway,
      parentConfirmed: !!(reportState.parentConfirmed || draft.parentConfirmed)
    }) : null);
  const uploadedMaterialServiceHandoffPack = normalizeProfileServiceHandoffPack(
    reportState.serviceHandoffPack
    || draft.serviceHandoffPack
    || uploadedMaterialDecisionDossier.serviceHandoffPack
    || (uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.serviceHandoffPack)
    || null
  );
  const uploadedMaterialServiceHandoffActions = buildProfileServiceHandoffActions(
    uploadedMaterialServiceHandoffPack,
    servicePathway,
    uploadedMaterialReportHandoff
  );
  const parentDecisionBook = reportState.parentDecisionBook || draft.parentDecisionBook || {};
  const matrix = Array.isArray(draft.diagnosisMatrix) ? draft.diagnosisMatrix : [];
  const tendencies = Array.isArray(draft.capabilityTendencies) ? draft.capabilityTendencies : [];
  const effectiveCourseUnitMap = courseUnitMap || (storage.buildCourseUnitMap ? storage.buildCourseUnitMap({}) : null);
  const courseUnitMasteryTrajectory = storage.buildCourseUnitMasteryTrajectory
    ? storage.buildCourseUnitMasteryTrajectory({ courseUnitMap: effectiveCourseUnitMap })
    : null;
  const courseUnitQuestionBank = storage.buildCourseUnitQuestionBank
    ? storage.buildCourseUnitQuestionBank({ courseUnitMap: effectiveCourseUnitMap })
    : null;
  const courseUnitDepthExpansionAtlas = storage.buildCourseUnitDepthExpansionAtlas
    ? storage.buildCourseUnitDepthExpansionAtlas({ courseUnitMap: effectiveCourseUnitMap, courseUnitQuestionBank })
    : null;
  const commercialDepthRunway = storage.buildCommercialDepthRunway
    ? storage.buildCommercialDepthRunway({
      courseUnitMap: effectiveCourseUnitMap,
      courseUnitMasteryTrajectory,
      courseUnitQuestionBank,
      courseUnitDepthExpansionAtlas,
      subjectSkillDepth
    })
    : null;
  const weeklyEvidenceFlywheel = storage.buildWeeklyEvidenceFlywheel
    ? storage.buildWeeklyEvidenceFlywheel({
      courseUnitMap: effectiveCourseUnitMap,
      courseUnitMasteryTrajectory,
      courseUnitQuestionBank,
      commercialDepthRunway,
      subjectSkillDepth
    })
    : null;
  const questionBankShareRelayDeck = storage.buildQuestionBankShareRelayDeck
    ? storage.buildQuestionBankShareRelayDeck({
      courseUnitMap: effectiveCourseUnitMap,
      courseUnitQuestionBank,
      weeklyEvidenceFlywheel,
      subjectSkillDepth
    })
    : null;
  const sevenSubjectMasterySprint = storage.buildSevenSubjectMasterySprint
    ? storage.buildSevenSubjectMasterySprint({
      courseUnitMap: effectiveCourseUnitMap,
      courseUnitMasteryTrajectory,
      courseUnitQuestionBank,
      commercialDepthRunway,
      weeklyEvidenceFlywheel,
      subjectSkillDepth
    })
    : null;
  const mainDiagnosis = matrix.find((item) => item.status === '需要支持') || matrix[0] || null;
  const sevenDayPlan = Array.isArray(plan.sevenDayPlan) ? plan.sevenDayPlan.slice(0, 7) : [];
  const dayOne = sevenDayPlan[0] || {};
  const dayTwo = sevenDayPlan[1] || {};
  const daySeven = sevenDayPlan[6] || sevenDayPlan[sevenDayPlan.length - 1] || {};
  const nextEvidence = Array.isArray(solutionMap.nextEvidenceRequired) && solutionMap.nextEvidenceRequired.length
    ? solutionMap.nextEvidenceRequired
    : ['child_first_step', 'focus_or_review_record', 'next_day_revisit'];
  const reportEvidenceTopLine = (() => {
    const decision = reportEvidenceReleaseGate.releaseDecision || 'collect_more_evidence';
    const required = Array.isArray(reportEvidenceReleaseGate.evidenceRequired)
      ? reportEvidenceReleaseGate.evidenceRequired
      : [];
    const next = reportEvidenceReleaseGate.portraitNextEvidenceAction
      || (sourceEvidenceLedger.nextEvidenceLine || '')
      || required.slice(0, 2).join(' / ')
      || nextEvidence.slice(0, 2).join(' / ');
    const locked = reportEvidenceReleaseGate.homeSchoolSafeHandoff && reportEvidenceReleaseGate.homeSchoolSafeHandoff.status !== 'ready';
    return locked
      ? `报告还不能当长期结论：${decision}；下一证据：${next}`
      : `报告可进入家校安全交接：${decision}；下一证据：${next}`;
  })();
  const nextActionRoute = (solutionMap.appHandoff && solutionMap.appHandoff.route)
    || (plan.cta && plan.cta.path)
    || '/pages/tutor/tutor?from=learning_report';
  const howToLearnBetter = [
    plan.parentLine || '',
    solutionMap.childScript || '',
    parentDecisionBook.oneSentenceDecision || ''
  ].filter(Boolean).slice(0, 3).join(' / ') || '先让孩子说出第一步，再用错因和隔天回访确认方法是否真的稳定。';
  const sevenDayActionBoard = {
    title: '7天行动板',
    ready: sevenDayPlan.length >= 3,
    today: dayOne.task || plan.parentLine || '今晚先让孩子说出第一步。',
    tomorrow: dayTwo.task || '明天先回看一张卡，确认不是当场会、转身忘。',
    review: daySeven.task || solutionMap.reviewTrigger || '第 7 天用新错题或小测更新一次画像。',
    parentScript: solutionMap.parentScript || plan.parentLine || '家长先问一句：这一步你准备先看哪里？',
    childScript: solutionMap.childScript || plan.childLine || '我先说出第一步。',
    evidenceLine: [nextEvidence.join(' / '), globalEvidenceBrief && globalEvidenceBrief.reportLine, nextCapability && nextCapability.evidenceLine].filter(Boolean).join(' / '),
    routeLabel: plan.cta && plan.cta.label ? plan.cta.label : '进入第一步练习',
    routePath: plan.cta && plan.cta.path ? plan.cta.path : '/pages/tutor/tutor?from=learning_report',
    days: sevenDayPlan.map((item) => ({
      day: item.day,
      task: item.task,
      minutes: item.minutes,
      module: item.module,
      path: item.path,
      checkpoint: item.checkpoint || item.parentPrompt || ''
    }))
  };
  const subjectDepthEvidenceLine = subjectSkillDepth && Array.isArray(subjectSkillDepth.evidenceRequired)
    ? subjectSkillDepth.evidenceRequired.join(' / ')
    : '';
  const courseUnitDecisionBoard = buildCourseUnitDecisionBoard(effectiveCourseUnitMap);
  const familyDecisionActionBridge = buildFamilyDecisionActionBridge({
    familyDecisionMemo,
    reportDailyActionQueue,
    sevenDayActionBoard,
    nextCapability,
    subjectSkillDepth,
    visualSocraticMatrix,
    courseUnitDecisionBoard,
    solutionMap,
    plan
  });
  const todaySession = storage.getTodaySession ? storage.getTodaySession() : {};
  const gameEvidence = todaySession && todaySession.gameEvidence ? todaySession.gameEvidence : {};
  const highFrequencyLoopForReport = gameEvidence.highFrequencyPracticeLoop || reportState.highFrequencyPracticeLoop || draft.highFrequencyPracticeLoop || {};
  const dailyReturnContractForReport = reportState.dailyReturnContract
    || draft.dailyReturnContract
    || gameEvidence.dailyReturnContract
    || highFrequencyLoopForReport.dailyReturnContract
    || null;
  const reviewReturnSeedForReport = reportState.reviewReturnSeed
    || draft.reviewReturnSeed
    || gameEvidence.reviewReturnSeed
    || highFrequencyLoopForReport.reviewReturnSeed
    || null;
  const spacedRecallPolicyForReport = reportState.spacedRecallPolicy
    || draft.spacedRecallPolicy
    || gameEvidence.spacedRecallPolicy
    || highFrequencyLoopForReport.spacedRecallPolicy
    || (reviewReturnSeedForReport && reviewReturnSeedForReport.spacedRecallPolicy)
    || null;
  const gameReturnEvidence = reportState.gameReturnEvidence
    || draft.gameReturnEvidence
    || (learningReport.buildGameReturnEvidence
      ? learningReport.buildGameReturnEvidence({
        dailyReturnContract: dailyReturnContractForReport,
        reviewReturnSeed: reviewReturnSeedForReport,
        spacedRecallPolicy: spacedRecallPolicyForReport,
        gameEvidence,
        highFrequencyPracticeLoop: highFrequencyLoopForReport
      })
      : null);
  const aiLocalImplementationMatrix = reportState.aiLocalImplementationMatrix
    || draft.aiLocalImplementationMatrix
    || null;
  const memoryRiskReleaseModel = gameEvidence.highFrequencyPracticeLoop && gameEvidence.highFrequencyPracticeLoop.memoryRiskReleaseModel
    ? gameEvidence.highFrequencyPracticeLoop.memoryRiskReleaseModel
    : (draft.memoryRiskReleaseModel || null);
  const socraticMemoryReportBridge = learningReport.buildSocraticMemoryReportBridge
    ? learningReport.buildSocraticMemoryReportBridge({ gameEvidence }, parentDecisionTrustSystem, portraitConfidenceSystem)
    : (draft.socraticMemoryReportBridge || null);
  const questionBankDecisionBridge = learningReport.buildQuestionBankDecisionBridge
    ? learningReport.buildQuestionBankDecisionBridge({ gameEvidence }, parentDecisionTrustSystem, portraitConfidenceSystem)
    : (draft.questionBankDecisionBridge || null);
  const questionBankRecallReportBridge = learningReport.buildQuestionBankRecallReportBridge
    ? learningReport.buildQuestionBankRecallReportBridge({ gameEvidence }, parentDecisionTrustSystem, portraitConfidenceSystem)
    : (draft.questionBankRecallReportBridge || null);
  const portraitDecisionReleaseSystem = learningReport.buildPortraitDecisionReleaseSystem
    ? learningReport.buildPortraitDecisionReleaseSystem({ gameEvidence }, parentDecisionTrustSystem, portraitConfidenceSystem, portraitEvidenceMaturitySystem, questionBankRecallReportBridge)
    : (draft.portraitDecisionReleaseSystem || null);
  const fallbackRecoveryReportBridge = latestThinkingReceipt && latestThinkingReceipt.fallback_recovery_bridge
    ? latestThinkingReceipt.fallback_recovery_bridge
    : null;
  const socraticPromptQualityJudge = latestThinkingReceipt && (latestThinkingReceipt.socratic_prompt_quality_judge || latestThinkingReceipt.socraticPromptQualityJudge)
    ? (latestThinkingReceipt.socratic_prompt_quality_judge || latestThinkingReceipt.socraticPromptQualityJudge)
    : null;
  const tonightDecisionBrief = draft.tonightDecisionBrief || (learningReport.buildTonightDecisionBrief
    ? learningReport.buildTonightDecisionBrief(
      reportState || {},
      reportState.diagnosisMatrix || draft.diagnosisMatrix || [],
      familyDecisionMemo,
      parentDecisionTrustSystem,
      questionBankRecallReportBridge,
      socraticPromptQualityJudge
    )
    : null);
  const parentReflectionSummary = storage.buildParentReflectionSummary
    ? storage.buildParentReflectionSummary()
    : {};
  const familyDecisionHomepage = buildFamilyDecisionHomepage({
    familyDecisionMemo,
    tonightDecisionBrief,
    reportEvidenceReleaseGate,
    sourceEvidenceLedger,
    parentDecisionBook,
    reportDailyActionQueue,
    familyDecisionActionBridge,
    homeSchoolCollaborationDigest,
    parentReflectionSummary
  });
  const tonightParentDecisionCard = buildTonightParentDecisionCard({
    familyDecisionHomepage,
    tonightDecisionBrief,
    familyDecisionMemo,
    reportDailyActionQueue
  });
  const realHomeworkCoverageMatrix = storage.buildRealHomeworkCoverageMatrix
    ? storage.buildRealHomeworkCoverageMatrix({
      subject: subjectSkillDepth && subjectSkillDepth.subject ? subjectSkillDepth.subject : ''
    })
    : null;
  const reportPressureTruthAudit = storage.buildReportPressureTruthAudit
    ? storage.buildReportPressureTruthAudit(realHomeworkCoverageMatrix || {}, {
      reportState,
      subjectSkillDepth
    })
    : null;
  const realTrialRecoveryLoop = storage.buildRealTrialRecoveryLoop
    ? storage.buildRealTrialRecoveryLoop({ realHomeworkCoverageMatrix })
    : null;
  const openMaicDecisionBridge = reportState.openMaicInspiredDecisionBridge
    || draft.openMaicInspiredDecisionBridge
    || null;
  const publicK12Resources = realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.publicK12OpenSourceResourceLedger)
    ? realHomeworkCoverageMatrix.publicK12OpenSourceResourceLedger
    : [];
  const publicK12Workbench = realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.publicK12UseWorkbench)
    ? realHomeworkCoverageMatrix.publicK12UseWorkbench
    : [];
  const publicK12ChallengeDeck = realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.publicK12IntakeChallengeDeck)
    ? realHomeworkCoverageMatrix.publicK12IntakeChallengeDeck
    : [];
  const openMaicBorrowWorkbench = {
    id: 'openmaic_k12_borrow_workbench',
    title: '小讲堂借力工作台',
    summary: `只借公开资料的结构、场景流和质量门；本地代码负责门禁、回流、奖励、隐私和报告放行，AI 只负责追问与表达。`,
    statusLine: `已接 ${publicK12Resources.length} 类公开资料线索、${publicK12Workbench.length} 条使用工作台、${publicK12ChallengeDeck.length} 张可玩采集卡。`,
    sourcePolicyLine: openMaicDecisionBridge && openMaicDecisionBridge.sourcePolicy
      ? '只借公开结构和课堂编排思路，不复制代码、不照搬题文、不承诺完整 AI 课堂。'
      : '只参考两阶段生成、事件流和质量门，不复制代码、不照搬提示词、不做完整课堂平台。',
    releaseLine: '放行规则：没有孩子第一步、错因回放、次日回访和家长确认，不写长期画像，不发奖励，不生成可分享结论。',
    lanes: [
      {
        id: 'source',
        label: '公开资料',
        owner: '本地代码 + 人工校验',
        action: '抽取课程结构、题型簇、常见错因和可玩挑战，不复制原题、答案或受限内容。',
        route: '/pages/upload/upload?from=openmaic_k12_workbench&type=school_material'
      },
      {
        id: 'ai',
        label: 'AI 更适合',
        owner: 'AI 追问',
        action: '生成苏格拉底追问、儿童化解释、家长摘要和小黑板话术，但不能决定答案、掌握度、天赋标签。',
        route: '/pages/tutor/tutor?from=openmaic_k12_workbench'
      },
      {
        id: 'local',
        label: '本地代码更适合',
        owner: '确定性规则',
        action: '负责题型路由、XP 门禁、间隔复习、分享字段、报告放行和隐私拒绝清单。',
        route: '/pages/arcade/arcade?from=openmaic_k12_workbench'
      },
      {
        id: 'report',
        label: '家长报告',
        owner: '证据账本',
        action: '天赋测评只做学习方法候选；错题/试卷进入错因与回访；学校材料生成家校沟通摘要。',
        route: '/pages/upload/upload?from=openmaic_k12_workbench&type=talent_assessment'
      }
    ],
    blockedClaims: ['完整答案', '拍照自动解题', '天赋定性', '分数排名外传', '复制开源题库原文'],
    nextRoutes: [
      { id: 'upload_wrong_paper', label: '上传错题/试卷', route: '/pages/upload/upload?from=openmaic_k12_workbench&type=wrong_question_paper' },
      { id: 'upload_talent', label: '录入天赋/学习偏好测评', route: '/pages/upload/upload?from=openmaic_k12_workbench&type=talent_assessment' },
      { id: 'socratic', label: '去问第一步', route: '/pages/tutor/tutor?from=openmaic_k12_workbench' },
      { id: 'review', label: '做一次回访', route: '/pages/review/review?from=openmaic_k12_workbench' }
    ]
  };
  openMaicBorrowWorkbench.nextRoutes.splice(2, 0, {
    id: 'upload_parent_report',
    label: '家长观察',
    route: '/pages/upload/upload?from=openmaic_k12_workbench&type=parent_report'
  });
  const uploadedMaterialDeliveryView = buildProfileDossierDeliveryView(uploadedMaterialDecisionDossier, servicePathway);
  const reportRevisitEvidence = reportState.reportRevisitEvidence || uploadedMaterialDecisionDossier.servicePathwaySummary && uploadedMaterialDecisionDossier.servicePathwaySummary.revisitEvidence || null;
  const partnerServiceReviewCard = buildPartnerServiceReviewCard(partnerWorkbench, servicePathway, reportRevisitEvidence);
  const personalizedParentReportPreview = reportState.personalizedParentReportPreview
    || draft.personalizedParentReportPreview
    || (uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.personalizedParentReportPreviewMeta)
    || null;
  const personalizedParentReportStandard = reportState.reportStandard
    || draft.reportStandard
    || (personalizedParentReportPreview && personalizedParentReportPreview.standard)
    || (uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.reportStandard)
    || null;
  const personalizedParentReportExportPolicy = reportState.reportExportPolicy
    || draft.reportExportPolicy
    || (personalizedParentReportPreview && personalizedParentReportPreview.exportPolicy)
    || (uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.reportExportPolicy)
    || null;
  return {
    title: draft.title || '学习画像',
    modeLabel: reportState.reportProgress && reportState.reportProgress.label ? reportState.reportProgress.label : '0% · 快速版',
    statusLabel: reportState.reportStatus && reportState.reportStatus.label ? reportState.reportStatus.label : '可生成快速版',
    completeness: Number(reportState.reportCompleteness || 0),
    overviewLine: overview.line || '先补一张成绩单或测评描述，咕点会先给出快速版画像。',
    evidenceLine: (overview.evidence || []).slice(0, 2).join(' · '),
    diagnosisLine: mainDiagnosis ? `${mainDiagnosis.subject} · ${mainDiagnosis.summary}` : '先补充一份成绩或测评描述。',
    planLine: plan.parentLine || '家长先问一句：这一步你准备先看哪里？',
    ctaLabel: plan.cta && plan.cta.label ? plan.cta.label : '先用咕点追问第一步',
    ctaPath: plan.cta && plan.cta.path ? plan.cta.path : '/pages/tutor/tutor?from=learning_report',
    ctaReason: plan.cta && plan.cta.reason ? plan.cta.reason : '先从最小的一步开始。',
    solutionConfidence: solutionMap.confidence || (mainDiagnosis && mainDiagnosis.confidence) || '低',
    solutionEvidenceLine: Array.isArray(solutionMap.evidence) && solutionMap.evidence.length
      ? solutionMap.evidence.slice(0, 3).join(' · ')
      : (overview.evidence || []).slice(0, 2).join(' · '),
    solutionMissingLine: Array.isArray(solutionMap.missing) && solutionMap.missing.length
      ? solutionMap.missing.slice(0, 3).join(' · ')
      : (draft.missingItems || []).slice(0, 3).join(' · '),
    liveEvidenceLine: globalEvidenceBrief ? globalEvidenceBrief.reportLine : '',
    liveEvidenceSummary: globalEvidenceBrief ? globalEvidenceBrief.summary : '',
    liveEvidenceCards: globalEvidenceBrief ? globalEvidenceBrief.cards : [],
    capabilityLedger,
    capabilityNextLine: nextCapability ? `${nextCapability.label} · ${nextCapability.nextAction}` : '',
    capabilityEvidenceLine: nextCapability && nextCapability.evidenceLine
      ? nextCapability.evidenceLine
      : (capabilityLedger && (capabilityLedger.parentLine || capabilityLedger.summary)) || '',
    capabilityRoute: nextCapability && nextCapability.route ? nextCapability.route : '',
    capabilityProgressLine: capabilityLedger ? `${capabilityLedger.readyCount} / ${capabilityLedger.totalCount} · ${capabilityLedger.summary}` : '',
    subjectSkillDepth,
    subjectSkillDepthLine: subjectSkillDepth && subjectSkillDepth.label
      ? `${subjectSkillDepth.label} · ${subjectSkillDepth.firstStep}`
      : '',
    subjectSkillDepthEvidence: subjectDepthEvidenceLine,
    subjectSkillDepthParentQuestion: subjectSkillDepth && subjectSkillDepth.parentQuestion ? subjectSkillDepth.parentQuestion : '',
    curriculumSpine,
    curriculumReportLine: curriculumSpine && curriculumSpine.reportLine ? curriculumSpine.reportLine : '',
    curriculumParentDecisionLine: curriculumSpine && curriculumSpine.parentDecisionLine ? curriculumSpine.parentDecisionLine : '',
    curriculumVisualBoardLine: curriculumSpine && curriculumSpine.visualBoardLine ? curriculumSpine.visualBoardLine : '',
    visualSocraticMatrix,
    visualSocraticReportLine: visualSocraticMatrix && visualSocraticMatrix.reportLine ? visualSocraticMatrix.reportLine : '',
    visualSocraticBoundary: visualSocraticMatrix && visualSocraticMatrix.visualBoundary ? visualSocraticMatrix.visualBoundary : '',
    courseUnitMap: effectiveCourseUnitMap,
    courseUnitDecisionBoard,
    courseUnitReportLine: courseUnitDecisionBoard ? courseUnitDecisionBoard.reportContract : '',
    courseUnitParentDecisionLine: courseUnitDecisionBoard ? courseUnitDecisionBoard.parentTonightDecision : '',
    courseUnitClassroomLine: courseUnitDecisionBoard ? courseUnitDecisionBoard.classroomObservationLine : '',
    courseUnitSevenDayLine: courseUnitDecisionBoard ? courseUnitDecisionBoard.sevenDayReviewLine : '',
    courseUnitMasteryTrajectory,
    courseUnitTrajectoryLine: courseUnitMasteryTrajectory ? courseUnitMasteryTrajectory.reportLine : '',
    courseUnitTrajectoryParentLine: courseUnitMasteryTrajectory ? courseUnitMasteryTrajectory.parentLine : '',
    courseUnitTrajectoryWeakest: courseUnitMasteryTrajectory ? courseUnitMasteryTrajectory.weakest : null,
    courseUnitTrajectoryRows: courseUnitMasteryTrajectory ? courseUnitMasteryTrajectory.trajectories : [],
    courseUnitQuestionBank,
    courseUnitQuestionBankLine: courseUnitQuestionBank ? courseUnitQuestionBank.reportLine : '',
    courseUnitQuestionBankCards: courseUnitQuestionBank ? courseUnitQuestionBank.activeCards : [],
    courseUnitDepthExpansionAtlas,
    courseUnitDepthExpansionLine: courseUnitDepthExpansionAtlas ? courseUnitDepthExpansionAtlas.reportLine : '',
    courseUnitDepthExpansionArchetypes: courseUnitDepthExpansionAtlas && Array.isArray(courseUnitDepthExpansionAtlas.activeArchetypes)
      ? courseUnitDepthExpansionAtlas.activeArchetypes
      : [],
    courseUnitTransferLadders: courseUnitQuestionBank && Array.isArray(courseUnitQuestionBank.activeTransferLadders)
      ? courseUnitQuestionBank.activeTransferLadders
      : [],
    courseUnitTransferLadderLine: courseUnitQuestionBank
      ? `题型迁移路径 ${courseUnitQuestionBank.transferLadderCount || 0} 条，覆盖 ${courseUnitQuestionBank.transferLadderRungCount || 0} 个可观察台阶。`
      : '',
    commercialDepthRunway,
    commercialDepthRunwayLine: commercialDepthRunway ? commercialDepthRunway.reportLine : '',
    commercialDepthRunwayLanes: commercialDepthRunway ? commercialDepthRunway.lanes : [],
    commercialDepthParentRubric: commercialDepthRunway ? commercialDepthRunway.parentDecisionRubric : [],
    commercialDepthVisualBoardMoves: commercialDepthRunway ? commercialDepthRunway.visualBoardMoves : [],
    realHomeworkCoverageMatrix,
    realHomeworkCoverageLine: realHomeworkCoverageMatrix ? realHomeworkCoverageMatrix.reportLine : '',
    realHomeworkCoverageSubjects: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.subjectRows)
      ? realHomeworkCoverageMatrix.subjectRows
      : [],
    realHomeworkCoverageTypes: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.typeRows)
      ? realHomeworkCoverageMatrix.typeRows.slice(0, 6)
      : [],
    realHomeworkCoverageClusters: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.sampleClusters)
      ? realHomeworkCoverageMatrix.sampleClusters
      : [],
    realHomeworkQuestionTypeClusters: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.questionTypeClusterRunway)
      ? realHomeworkCoverageMatrix.questionTypeClusterRunway
      : [],
    realHomeworkPublicSources: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.publicSourceLedger)
      ? realHomeworkCoverageMatrix.publicSourceLedger
      : [],
    realHomeworkUseWorkbench: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.publicK12UseWorkbench)
      ? realHomeworkCoverageMatrix.publicK12UseWorkbench
      : [],
    realHomeworkOpenSourceResources: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.publicK12OpenSourceResourceLedger)
      ? realHomeworkCoverageMatrix.publicK12OpenSourceResourceLedger
      : [],
    realHomeworkPublicResourceTriageBoard: realHomeworkCoverageMatrix ? realHomeworkCoverageMatrix.publicResourceTriageBoard : null,
    realHomeworkPublicResourceTriageLanes: realHomeworkCoverageMatrix && realHomeworkCoverageMatrix.publicResourceTriageBoard && Array.isArray(realHomeworkCoverageMatrix.publicResourceTriageBoard.lanes)
      ? realHomeworkCoverageMatrix.publicResourceTriageBoard.lanes
      : [],
    realHomeworkPublicResourceTriageCards: realHomeworkCoverageMatrix && realHomeworkCoverageMatrix.publicResourceTriageBoard && Array.isArray(realHomeworkCoverageMatrix.publicResourceTriageBoard.resourceCards)
      ? realHomeworkCoverageMatrix.publicResourceTriageBoard.resourceCards
      : [],
    realHomeworkPublicResourceChallengeSeeds: realHomeworkCoverageMatrix && realHomeworkCoverageMatrix.publicResourceTriageBoard && Array.isArray(realHomeworkCoverageMatrix.publicResourceTriageBoard.sourceBackedChallengeSeeds)
      ? realHomeworkCoverageMatrix.publicResourceTriageBoard.sourceBackedChallengeSeeds
      : [],
    realHomeworkLocalAiRunway: realHomeworkCoverageMatrix ? realHomeworkCoverageMatrix.localAiImplementationRunway : null,
    realHomeworkLocalAiRunwayModules: realHomeworkCoverageMatrix && realHomeworkCoverageMatrix.localAiImplementationRunway && Array.isArray(realHomeworkCoverageMatrix.localAiImplementationRunway.moduleRows)
      ? realHomeworkCoverageMatrix.localAiImplementationRunway.moduleRows
      : [],
    realHomeworkLocalAiResourceCoverage: realHomeworkCoverageMatrix && realHomeworkCoverageMatrix.localAiImplementationRunway && Array.isArray(realHomeworkCoverageMatrix.localAiImplementationRunway.resourceCoverage)
      ? realHomeworkCoverageMatrix.localAiImplementationRunway.resourceCoverage
      : [],
    pressureFailureTypeAudit: realHomeworkCoverageMatrix ? realHomeworkCoverageMatrix.pressureFailureTypeAudit : null,
    pressureFailureTypeRisks: realHomeworkCoverageMatrix && realHomeworkCoverageMatrix.pressureFailureTypeAudit && Array.isArray(realHomeworkCoverageMatrix.pressureFailureTypeAudit.topRiskRows)
      ? realHomeworkCoverageMatrix.pressureFailureTypeAudit.topRiskRows
      : [],
    pressureFailureTypeSubjects: realHomeworkCoverageMatrix && realHomeworkCoverageMatrix.pressureFailureTypeAudit && Array.isArray(realHomeworkCoverageMatrix.pressureFailureTypeAudit.subjectRows)
      ? realHomeworkCoverageMatrix.pressureFailureTypeAudit.subjectRows
      : [],
    pressureFailureTypeSamples: realHomeworkCoverageMatrix && realHomeworkCoverageMatrix.pressureFailureTypeAudit && Array.isArray(realHomeworkCoverageMatrix.pressureFailureTypeAudit.weakSamples)
      ? realHomeworkCoverageMatrix.pressureFailureTypeAudit.weakSamples
      : [],
    realHomeworkIntakeQueue: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.publicK12HomeworkIntakeQueue)
      ? realHomeworkCoverageMatrix.publicK12HomeworkIntakeQueue
      : [],
    realHomeworkIntakeChallengeDeck: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.publicK12IntakeChallengeDeck)
      ? realHomeworkCoverageMatrix.publicK12IntakeChallengeDeck
      : [],
    realHomeworkImplementationDecisions: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.implementationDecisionMatrix)
      ? realHomeworkCoverageMatrix.implementationDecisionMatrix
      : [],
    openMaicDecisionBridge,
    openMaicMiniLessonReport: openMaicDecisionBridge ? openMaicDecisionBridge.miniLessonReport : null,
    openMaicMiniLessonTitle: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.title : '',
    openMaicMiniLessonTriggerLine: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.triggerLine : '',
    openMaicMiniLessonConceptGap: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.conceptGap : '',
    openMaicMiniLessonTopicLabel: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.topicLabel : '',
    openMaicMiniLessonTopicLocalGate: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.topicLocalGate : '',
    openMaicMiniLessonTopicPractice: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.topicPractice : null,
    openMaicMiniLessonActiveRecallLadder: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport && Array.isArray(openMaicDecisionBridge.miniLessonReport.activeRecallRevisitLadder) ? openMaicDecisionBridge.miniLessonReport.activeRecallRevisitLadder : [],
    openMaicMiniLessonBlackboardLine: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.blackboardLine : '',
    openMaicMiniLessonBlackboardFrames: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport && Array.isArray(openMaicDecisionBridge.miniLessonReport.blackboardFrames) ? openMaicDecisionBridge.miniLessonReport.blackboardFrames : [],
    openMaicMiniLessonBlackboardRenderPrompt: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.blackboardRenderPrompt : '',
    openMaicMiniLessonMisconceptionLine: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.misconceptionLine : '',
    openMaicMiniLessonCheckQuestion: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.checkQuestion : '',
    openMaicMiniLessonParentLine: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.parentLine : '',
    openMaicMiniLessonNextDayReview: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.nextDayReview : '',
    openMaicMiniLessonExitGate: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.exitGate : '',
    openMaicMiniLessonTeacherSchoolBridge: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.teacherSchoolBridge : null,
    openMaicMiniLessonBoundary: openMaicDecisionBridge && openMaicDecisionBridge.miniLessonReport ? openMaicDecisionBridge.miniLessonReport.boundary : '',
    openMaicHomeSchoolMiniLessonPacket: openMaicDecisionBridge ? openMaicDecisionBridge.homeSchoolMiniLessonPacket : null,
    openMaicBorrowWorkbench,
    openMaicBorrowWorkbenchLanes: openMaicBorrowWorkbench.lanes,
    openMaicBorrowWorkbenchBlockedClaims: openMaicBorrowWorkbench.blockedClaims,
    openMaicBorrowWorkbenchNextRoutes: openMaicBorrowWorkbench.nextRoutes,
    reportPressureTruthAudit,
    reportPressureTruthLine: reportPressureTruthAudit ? reportPressureTruthAudit.sampleLine : '',
    reportPressureTruthRows: reportPressureTruthAudit && Array.isArray(reportPressureTruthAudit.pressureRows)
      ? reportPressureTruthAudit.pressureRows
      : [],
    reportPressureFailureTraps: reportPressureTruthAudit && Array.isArray(reportPressureTruthAudit.failureTraps)
      ? reportPressureTruthAudit.failureTraps
      : [],
    reportPressureGates: reportPressureTruthAudit && Array.isArray(reportPressureTruthAudit.reportGates)
      ? reportPressureTruthAudit.reportGates
      : [],
    reportPressureSourceDecision: reportPressureTruthAudit && Array.isArray(reportPressureTruthAudit.sourceDecision)
      ? reportPressureTruthAudit.sourceDecision
      : [],
    realTrialRecoveryLoop,
    realTrialRecoveryLine: realTrialRecoveryLoop ? realTrialRecoveryLoop.reportLine : '',
    realTrialGameChallengeLine: realTrialRecoveryLoop ? realTrialRecoveryLoop.gameChallengeLine : '',
    realTrialGameChallengeCards: realTrialRecoveryLoop && Array.isArray(realTrialRecoveryLoop.gameChallengeCards)
      ? realTrialRecoveryLoop.gameChallengeCards
      : [],
    realTrialPressureCandidateLine: realTrialRecoveryLoop ? realTrialRecoveryLoop.pressureCandidateLine : '',
    realTrialPressureCandidateCards: realTrialRecoveryLoop && Array.isArray(realTrialRecoveryLoop.pressureCandidateCards)
      ? realTrialRecoveryLoop.pressureCandidateCards
      : [],
    realTrialSocraticStressLine: realTrialRecoveryLoop ? realTrialRecoveryLoop.socraticStressLine : '',
    realTrialSocraticStressRows: realTrialRecoveryLoop && Array.isArray(realTrialRecoveryLoop.socraticStressRows)
      ? realTrialRecoveryLoop.socraticStressRows
      : [],
    realTrialStressRepairLine: realTrialRecoveryLoop ? realTrialRecoveryLoop.stressRepairLine : '',
    realTrialStressRepairCards: realTrialRecoveryLoop && Array.isArray(realTrialRecoveryLoop.stressRepairCards)
      ? realTrialRecoveryLoop.stressRepairCards
      : [],
    realTrialRuleWritebackLine: realTrialRecoveryLoop ? realTrialRecoveryLoop.ruleWritebackLine : '',
    realTrialRuleWritebackPatches: realTrialRecoveryLoop && Array.isArray(realTrialRecoveryLoop.ruleWritebackPatches)
      ? realTrialRecoveryLoop.ruleWritebackPatches
      : [],
    realTrialRuleWritebackLanes: realTrialRecoveryLoop && Array.isArray(realTrialRecoveryLoop.ruleWritebackLanes)
      ? realTrialRecoveryLoop.ruleWritebackLanes
      : [],
    realTrialRuleRetestLine: realTrialRecoveryLoop ? realTrialRecoveryLoop.ruleRetestLine : '',
    realTrialRuleRetestCards: realTrialRecoveryLoop && Array.isArray(realTrialRecoveryLoop.ruleRetestCards)
      ? realTrialRecoveryLoop.ruleRetestCards
      : [],
    realTrialRuleRetestReviewLine: realTrialRecoveryLoop ? realTrialRecoveryLoop.ruleRetestReviewLine : '',
    realTrialRuleRetestReviewCards: realTrialRecoveryLoop && Array.isArray(realTrialRecoveryLoop.ruleRetestReviewCards)
      ? realTrialRecoveryLoop.ruleRetestReviewCards
      : [],
    realTrialRuleRetestChallengeCards: realTrialRecoveryLoop && Array.isArray(realTrialRecoveryLoop.ruleRetestChallengeCards)
      ? realTrialRecoveryLoop.ruleRetestChallengeCards
      : [],
    realTrialRecoveryRisks: realTrialRecoveryLoop && Array.isArray(realTrialRecoveryLoop.topRisks)
      ? realTrialRecoveryLoop.topRisks
      : [],
    realTrialRecoveryQueue: realTrialRecoveryLoop && Array.isArray(realTrialRecoveryLoop.nextPressureQueue)
      ? realTrialRecoveryLoop.nextPressureQueue
      : [],
    realTrialRecoveryLatest: realTrialRecoveryLoop && Array.isArray(realTrialRecoveryLoop.latest)
      ? realTrialRecoveryLoop.latest
      : [],
    weeklyEvidenceFlywheel,
    weeklyEvidenceFlywheelLine: weeklyEvidenceFlywheel ? weeklyEvidenceFlywheel.parentTrustLine : '',
    weeklyEvidenceFlywheelDays: weeklyEvidenceFlywheel ? weeklyEvidenceFlywheel.days : [],
    weeklyEvidenceFlywheelSharePayload: weeklyEvidenceFlywheel ? weeklyEvidenceFlywheel.sharePayload : null,
    questionBankShareRelayDeck,
    questionBankShareRelayTitle: questionBankShareRelayDeck ? questionBankShareRelayDeck.title : '',
    questionBankShareRelayLine: questionBankShareRelayDeck ? questionBankShareRelayDeck.reportLine : '',
    questionBankShareRelayGameRule: questionBankShareRelayDeck ? questionBankShareRelayDeck.gameRule : '',
    questionBankShareRelayParentDecision: questionBankShareRelayDeck ? questionBankShareRelayDeck.parentDecisionLine : '',
    questionBankShareRelayShareLine: questionBankShareRelayDeck ? questionBankShareRelayDeck.shareLine : '',
    questionBankShareRelayCards: questionBankShareRelayDeck && Array.isArray(questionBankShareRelayDeck.relayCards)
      ? questionBankShareRelayDeck.relayCards
      : [],
    questionBankShareRelayWindows: questionBankShareRelayDeck && Array.isArray(questionBankShareRelayDeck.reviewWindows)
      ? questionBankShareRelayDeck.reviewWindows
      : [],
    questionBankShareRelayPayload: questionBankShareRelayDeck ? questionBankShareRelayDeck.safeSharePayload : null,
    sevenSubjectMasterySprint,
    sevenSubjectMasterySprintLine: sevenSubjectMasterySprint ? sevenSubjectMasterySprint.parentDecisionLine : '',
    sevenSubjectMasterySprintSubjects: sevenSubjectMasterySprint ? sevenSubjectMasterySprint.subjects : [],
    sevenSubjectMasterySprintLanes: sevenSubjectMasterySprint ? sevenSubjectMasterySprint.lanes : [],
    longTermPortrait,
    longTermPortraitCanRender: portraitConfidenceSystem.portraitStage === 'weekly_portrait_candidate',
    longTermPortraitLockedLine: portraitConfidenceSystem.portraitStage === 'weekly_portrait_candidate'
      ? ''
      : (portraitConfidenceSystem.portraitStageReason || '当前证据只支持今晚行动，不能把孩子定性为长期画像。'),
    longTermPortraitLine: longTermPortrait.learnerPattern || '',
    longTermPortraitStabilityLine: longTermPortrait.stabilityLine || '',
    longTermPortraitRiskLine: longTermPortrait.riskWatch || '',
    longTermPortraitDimensions: Array.isArray(longTermPortrait.portraitDimensions) ? longTermPortrait.portraitDimensions : [],
    longTermPortraitTrajectoryFlags: Array.isArray(longTermPortrait.trajectoryFlags) ? longTermPortrait.trajectoryFlags : [],
    longTermPortraitConfidenceRubric: Array.isArray(longTermPortrait.evidenceConfidenceRubric) ? longTermPortrait.evidenceConfidenceRubric : [],
    longTermPortraitEvidence: Array.isArray(longTermPortrait.evidenceToCollect) ? longTermPortrait.evidenceToCollect : [],
    longTermPortraitObservationLoop: Array.isArray(longTermPortrait.observationLoop) ? longTermPortrait.observationLoop : [],
    longTermPortraitParentRule: longTermPortrait.parentDecisionRule || '',
    longTermPortraitTeacherConference: longTermPortrait.nextTeacherConference || '',
    classroomDecisionBoard,
    classroomDecisionLine: classroomDecisionBoard.decisionLine || '',
    classroomTeacherLens: classroomDecisionBoard.teacherLens || '',
    classroomParentLens: classroomDecisionBoard.parentLens || '',
    classroomEvidenceRule: classroomDecisionBoard.evidenceRule || '',
    classroomStopRule: classroomDecisionBoard.stopRule || '',
    classroomObservation: Array.isArray(classroomDecisionBoard.classLikeObservation) ? classroomDecisionBoard.classLikeObservation : [],
    classroomObservationRubric: Array.isArray(classroomDecisionBoard.observationRubric) ? classroomDecisionBoard.observationRubric : [],
    classroomInterventionLadder: Array.isArray(classroomDecisionBoard.interventionLadder) ? classroomDecisionBoard.interventionLadder : [],
    classroomEvidencePacket: Array.isArray(classroomDecisionBoard.classroomEvidencePacket) ? classroomDecisionBoard.classroomEvidencePacket : [],
    classroomCadence: classroomDecisionBoard.classroomCadence || '',
    classroomEscalationRule: classroomDecisionBoard.escalationRule || '',
    classroomSuccessRule: classroomDecisionBoard.successRule || '',
    familyDecisionMemo,
    portraitConfidenceSystem,
    portraitConfidenceStage: portraitConfidenceSystem.portraitStage || '',
    portraitConfidenceStageLabel: portraitConfidenceSystem.portraitStageLabel || '',
    portraitConfidenceStageReason: portraitConfidenceSystem.portraitStageReason || '',
    portraitConfidenceNextEvidenceAction: portraitConfidenceSystem.portraitNextEvidenceAction || '',
    portraitConfidenceStatusLine: portraitConfidenceSystem.portraitStageLabel
      ? `${portraitConfidenceSystem.portraitStageLabel} / ${portraitConfidenceSystem.portraitNextEvidenceAction || portraitConfidenceSystem.summary || ''}`
      : '',
    parentDecisionTrustSystem,
    longitudinalPortraitTimeline,
    portraitEvidenceMaturitySystem,
    crossWeekTrendBoard,
    homeSchoolCollaborationDigest,
    homeSchoolConferenceKit,
    reportEvidenceReleaseGate,
    sourceEvidenceLedger,
    longitudinalPortraitTimelineTitle: longitudinalPortraitTimeline.title || '',
    longitudinalPortraitTimelineStatus: longitudinalPortraitTimeline.status || '',
    longitudinalPortraitTimelineSummary: longitudinalPortraitTimeline.summary || '',
    longitudinalPortraitTimelineParentLine: longitudinalPortraitTimeline.parentLine || '',
    longitudinalPortraitTimelineRows: Array.isArray(longitudinalPortraitTimeline.timeline) ? longitudinalPortraitTimeline.timeline : [],
    longitudinalPortraitUpdateGates: Array.isArray(longitudinalPortraitTimeline.updateGates) ? longitudinalPortraitTimeline.updateGates : [],
    longitudinalPortraitRiskTransitions: Array.isArray(longitudinalPortraitTimeline.riskTransitions) ? longitudinalPortraitTimeline.riskTransitions : [],
    longitudinalPortraitEvidenceBacklog: Array.isArray(longitudinalPortraitTimeline.evidenceBacklog) ? longitudinalPortraitTimeline.evidenceBacklog : [],
    longitudinalPortraitShareBoundary: longitudinalPortraitTimeline.shareBoundary || '',
    portraitEvidenceMaturityTitle: portraitEvidenceMaturitySystem.title || '',
    portraitEvidenceMaturityLevel: portraitEvidenceMaturitySystem.maturityLevel || '',
    portraitEvidenceMaturityScore: Number(portraitEvidenceMaturitySystem.maturityScore || 0),
    portraitEvidenceMaturitySummary: portraitEvidenceMaturitySystem.summary || '',
    portraitEvidenceMaturityLanes: Array.isArray(portraitEvidenceMaturitySystem.maturityLanes) ? portraitEvidenceMaturitySystem.maturityLanes : [],
    portraitEvidenceDecisionLocks: Array.isArray(portraitEvidenceMaturitySystem.decisionLocks) ? portraitEvidenceMaturitySystem.decisionLocks : [],
    portraitEvidenceUpdateGates: Array.isArray(portraitEvidenceMaturitySystem.updateGateMirror) ? portraitEvidenceMaturitySystem.updateGateMirror : [],
    portraitEvidenceMaturityParentAction: portraitEvidenceMaturitySystem.parentAction || '',
    portraitEvidenceMaturityShareBoundary: portraitEvidenceMaturitySystem.shareBoundary || '',
    crossWeekTrendTitle: crossWeekTrendBoard.title || '',
    crossWeekTrendSummary: crossWeekTrendBoard.summary || '',
    crossWeekTrendRows: Array.isArray(crossWeekTrendBoard.trendRows) ? crossWeekTrendBoard.trendRows : [],
    crossWeekTrendUpdateRule: crossWeekTrendBoard.updateRule || '',
    crossWeekTrendRegressionRule: crossWeekTrendBoard.regressionRule || '',
    crossWeekTrendParentLine: crossWeekTrendBoard.parentLine || '',
    crossWeekTrendShareBoundary: crossWeekTrendBoard.shareBoundary || '',
    crossWeekTrendEvidence: Array.isArray(crossWeekTrendBoard.evidenceRequired) ? crossWeekTrendBoard.evidenceRequired : [],
    homeSchoolDigestTitle: homeSchoolCollaborationDigest.title || '',
    homeSchoolDigestTeacherQuestion: homeSchoolCollaborationDigest.teacherQuestion || '',
    homeSchoolDigestParentQuestion: homeSchoolCollaborationDigest.parentQuestion || '',
    homeSchoolDigestSuggestedMessage: homeSchoolCollaborationDigest.suggestedMessage || '',
    homeSchoolEvidencePacket: Array.isArray(homeSchoolCollaborationDigest.evidencePacket) ? homeSchoolCollaborationDigest.evidencePacket : [],
    homeSchoolTeacherDo: Array.isArray(homeSchoolCollaborationDigest.teacherDo) ? homeSchoolCollaborationDigest.teacherDo : [],
    homeSchoolParentDo: Array.isArray(homeSchoolCollaborationDigest.parentDo) ? homeSchoolCollaborationDigest.parentDo : [],
    homeSchoolDoNotShare: Array.isArray(homeSchoolCollaborationDigest.doNotShare) ? homeSchoolCollaborationDigest.doNotShare : [],
    homeSchoolHandoffCadence: Array.isArray(homeSchoolCollaborationDigest.handoffCadence) ? homeSchoolCollaborationDigest.handoffCadence : [],
    homeSchoolShareBoundary: homeSchoolCollaborationDigest.shareBoundary || '',
    homeSchoolConferenceTitle: homeSchoolConferenceKit.title || '',
    homeSchoolConferenceTeacherQuestions: Array.isArray(homeSchoolConferenceKit.teacherQuestions) ? homeSchoolConferenceKit.teacherQuestions : [],
    homeSchoolConferenceObservationRequest: Array.isArray(homeSchoolConferenceKit.classroomObservationRequest) ? homeSchoolConferenceKit.classroomObservationRequest : [],
    homeSchoolConferenceParentLog: Array.isArray(homeSchoolConferenceKit.parentHomeObservationLog) ? homeSchoolConferenceKit.parentHomeObservationLog : [],
    homeSchoolConferenceFeedbackLoop: Array.isArray(homeSchoolConferenceKit.sevenDayTeacherFeedbackLoop) ? homeSchoolConferenceKit.sevenDayTeacherFeedbackLoop : [],
    homeSchoolConferenceReleaseGate: homeSchoolConferenceKit.localReleaseGate || null,
    homeSchoolConferenceBlockedFields: homeSchoolConferenceKit.localReleaseGate && Array.isArray(homeSchoolConferenceKit.localReleaseGate.blockedFields)
      ? homeSchoolConferenceKit.localReleaseGate.blockedFields
      : [],
    homeSchoolConferenceShareBoundary: homeSchoolConferenceKit.shareBoundary || '',
    homeSchoolConferenceAiBoundary: homeSchoolConferenceKit.aiBoundary || '',
    reportEvidenceReleaseGateTitle: reportEvidenceReleaseGate.title || '',
    reportEvidenceReleaseDecision: reportEvidenceReleaseGate.releaseDecision || '',
    reportEvidenceReleaseSummary: reportEvidenceReleaseGate.summary || '',
    reportEvidenceTopLine,
    nextEvidenceTopLine: reportEvidenceReleaseGate.portraitNextEvidenceAction || (sourceEvidenceLedger.nextEvidenceLine || '') || nextEvidence.slice(0, 2).join(' / '),
    nextActionRoute,
    howToLearnBetter,
    reportEvidenceSingleSampleLock: reportEvidenceReleaseGate.singleSampleLock || null,
    reportEvidenceDay7Gate: reportEvidenceReleaseGate.day7Gate || null,
    reportEvidenceTwoWeekGate: reportEvidenceReleaseGate.twoWeekStabilityGate || null,
    reportEvidenceSafeHandoff: reportEvidenceReleaseGate.homeSchoolSafeHandoff || null,
    reportEvidenceAllowedFields: reportEvidenceReleaseGate.homeSchoolSafeHandoff && Array.isArray(reportEvidenceReleaseGate.homeSchoolSafeHandoff.allowedFields)
      ? reportEvidenceReleaseGate.homeSchoolSafeHandoff.allowedFields
      : [],
    reportEvidenceBlockedFields: reportEvidenceReleaseGate.homeSchoolSafeHandoff && Array.isArray(reportEvidenceReleaseGate.homeSchoolSafeHandoff.blockedFields)
      ? reportEvidenceReleaseGate.homeSchoolSafeHandoff.blockedFields
      : [],
    reportEvidenceConfidenceFloor: reportEvidenceReleaseGate.confidenceFloor || null,
    reportEvidenceAiBoundary: reportEvidenceReleaseGate.aiBoundary || '',
    reportEvidenceRequired: Array.isArray(reportEvidenceReleaseGate.evidenceRequired) ? reportEvidenceReleaseGate.evidenceRequired : [],
    gameReturnEvidence,
    gameReturnEvidenceTitle: gameReturnEvidence ? '游戏回流证据' : '',
    gameReturnEvidenceStatus: gameReturnEvidence ? gameReturnEvidence.status : '',
    gameReturnEvidenceNextRoute: gameReturnEvidence ? gameReturnEvidence.nextRoute : '',
    gameReturnEvidenceReleaseGate: gameReturnEvidence ? gameReturnEvidence.releaseGate : '',
    gameReturnEvidenceDay7Requirement: gameReturnEvidence ? gameReturnEvidence.day7Requirement : '',
    gameReturnEvidenceWeakKey: gameReturnEvidence ? gameReturnEvidence.weakKey : '',
    gameReturnEvidenceNextDayCardIds: gameReturnEvidence && Array.isArray(gameReturnEvidence.nextDayCardIds)
      ? gameReturnEvidence.nextDayCardIds
      : [],
    gameReturnEvidenceBlockedFields: gameReturnEvidence && Array.isArray(gameReturnEvidence.blockedFields)
      ? gameReturnEvidence.blockedFields
      : [],
    gameReturnEvidenceAllowedFields: gameReturnEvidence && Array.isArray(gameReturnEvidence.allowedFields)
      ? gameReturnEvidence.allowedFields
      : [],
    gameReturnEvidenceLocalCodeOwns: gameReturnEvidence && Array.isArray(gameReturnEvidence.localCodeOwns)
      ? gameReturnEvidence.localCodeOwns
      : [],
    gameReturnEvidenceAiMayRewrite: gameReturnEvidence && Array.isArray(gameReturnEvidence.aiMayRewrite)
      ? gameReturnEvidence.aiMayRewrite
      : [],
    gameReturnEvidenceRequired: gameReturnEvidence && Array.isArray(gameReturnEvidence.evidenceRequired)
      ? gameReturnEvidence.evidenceRequired
      : [],
    aiLocalImplementationMatrix,
    aiLocalImplementationTitle: aiLocalImplementationMatrix ? aiLocalImplementationMatrix.title : '',
    aiLocalImplementationSummary: aiLocalImplementationMatrix ? aiLocalImplementationMatrix.summary : '',
    aiLocalImplementationRows: aiLocalImplementationMatrix && Array.isArray(aiLocalImplementationMatrix.rows)
      ? aiLocalImplementationMatrix.rows
      : [],
    aiLocalImplementationLocalCodeOwns: aiLocalImplementationMatrix && Array.isArray(aiLocalImplementationMatrix.localCodeOwns)
      ? aiLocalImplementationMatrix.localCodeOwns
      : [],
    aiLocalImplementationAiBetterFor: aiLocalImplementationMatrix && Array.isArray(aiLocalImplementationMatrix.aiBetterFor)
      ? aiLocalImplementationMatrix.aiBetterFor
      : [],
    aiLocalImplementationAiMustNotOwn: aiLocalImplementationMatrix && Array.isArray(aiLocalImplementationMatrix.aiMustNotOwn)
      ? aiLocalImplementationMatrix.aiMustNotOwn
      : [],
    aiLocalImplementationBlockedFields: aiLocalImplementationMatrix && Array.isArray(aiLocalImplementationMatrix.blockedFields)
      ? aiLocalImplementationMatrix.blockedFields
      : [],
    aiLocalImplementationNextBuildOrder: aiLocalImplementationMatrix && Array.isArray(aiLocalImplementationMatrix.nextBuildOrder)
      ? aiLocalImplementationMatrix.nextBuildOrder
      : [],
    aiLocalImplementationBoundary: aiLocalImplementationMatrix ? aiLocalImplementationMatrix.productBoundaryLine : '',
    aiLocalImplementationReleaseGate: aiLocalImplementationMatrix ? aiLocalImplementationMatrix.releaseGate : '',
    sourceEvidenceLedgerTitle: sourceEvidenceLedger.title || '',
    sourceEvidenceLedgerSummary: sourceEvidenceLedger.summary || '',
    sourceEvidenceLedgerLocalRule: sourceEvidenceLedger.localRule || '',
    sourceEvidenceLedgerAiBoundary: sourceEvidenceLedger.aiBoundary || '',
    sourceEvidenceSafestNextAction: sourceEvidenceLedger.safestNextAction || '',
    sourceEvidenceLanes: Array.isArray(sourceEvidenceLedger.lanes) ? sourceEvidenceLedger.lanes : [],
    sourceEvidenceRequired: Array.isArray(sourceEvidenceLedger.evidenceRequired) ? sourceEvidenceLedger.evidenceRequired : [],
    servicePathway,
    servicePathwayTitle: servicePathway && servicePathway.title ? servicePathway.title : '',
    servicePathwayStatus: servicePathway && servicePathway.status ? servicePathway.status : '',
    servicePathwayNextAction: servicePathway && servicePathway.nextAction ? servicePathway.nextAction : '',
    servicePathwayModes: servicePathway && Array.isArray(servicePathway.modeRecommendations) ? servicePathway.modeRecommendations : [],
    servicePathwayModeChoiceProtocol: servicePathway && servicePathway.modeChoiceProtocol ? servicePathway.modeChoiceProtocol : null,
    servicePathwayModeChoiceCards: servicePathway && servicePathway.modeChoiceProtocol && Array.isArray(servicePathway.modeChoiceProtocol.choiceCards) ? servicePathway.modeChoiceProtocol.choiceCards : [],
    servicePathwayModeChoiceGuardrails: servicePathway && servicePathway.modeChoiceProtocol && Array.isArray(servicePathway.modeChoiceProtocol.guardrails) ? servicePathway.modeChoiceProtocol.guardrails : [],
    servicePathwayModeChoicePositioning: servicePathway && servicePathway.modeChoiceProtocol ? servicePathway.modeChoiceProtocol.positioningLine || '' : '',
    servicePathwayModeChoiceReleaseGate: servicePathway && servicePathway.modeChoiceProtocol ? servicePathway.modeChoiceProtocol.releaseGate || '' : '',
    servicePathwayTiers: servicePathway && Array.isArray(servicePathway.productTiers) ? servicePathway.productTiers : [],
    servicePathwayValidationPlan: servicePathway && Array.isArray(servicePathway.validationPlan) ? servicePathway.validationPlan : [],
    servicePathwayAiLocalSplit: servicePathway && Array.isArray(servicePathway.aiLocalDeliverySplit) ? servicePathway.aiLocalDeliverySplit : [],
    servicePathwayReleaseGate: servicePathway && servicePathway.safetyBoundary ? servicePathway.safetyBoundary.releaseGate : '',
    servicePathwayMoatLine: servicePathway && servicePathway.moatLine ? servicePathway.moatLine : '',
    partnerDeliveryWorkbench: partnerWorkbench,
    partnerWorkbenchTitle: partnerWorkbench ? '合作交付工作台' : '',
    partnerWorkbenchStatus: partnerWorkbench ? partnerWorkbench.status : '',
    partnerWorkbenchStatusLine: partnerWorkbench ? partnerStatusLine(partnerWorkbench.status) : '',
    partnerWorkbenchNextAction: partnerWorkbench ? partnerWorkbench.nextBestAction : '',
    partnerWorkbenchChildRecord: partnerWorkbench ? partnerWorkbench.childRecord : null,
    partnerWorkbenchMaterialLedger: partnerWorkbench && Array.isArray(partnerWorkbench.materialLedger) ? partnerWorkbench.materialLedger : [],
    partnerWorkbenchSolutionPipeline: partnerWorkbench && Array.isArray(partnerWorkbench.solutionPipeline) ? partnerWorkbench.solutionPipeline : [],
    partnerWorkbenchAdvisorQueue: partnerWorkbench && Array.isArray(partnerWorkbench.advisorQueue) ? partnerWorkbench.advisorQueue : [],
    partnerWorkbenchCrmExport: partnerWorkbench ? partnerWorkbench.crmExport : null,
    partnerWorkbenchCrmAllowedLine: partnerWorkbench && partnerWorkbench.crmExport ? formatPartnerFieldList(partnerWorkbench.crmExport.allowedFields) : '',
    partnerWorkbenchCrmBlockedLine: partnerWorkbench && partnerWorkbench.crmExport ? formatPartnerFieldList(partnerWorkbench.crmExport.blockedFields) : '',
    partnerWorkbenchPilotReadiness: partnerWorkbench ? partnerWorkbench.pilotReadinessChecklist : null,
    partnerWorkbenchPilotStatusLine: partnerWorkbench && partnerWorkbench.pilotReadinessChecklist ? pilotStatusLine(partnerWorkbench.pilotReadinessChecklist) : '',
    partnerWorkbenchPilotRows: partnerWorkbench && partnerWorkbench.pilotReadinessChecklist && Array.isArray(partnerWorkbench.pilotReadinessChecklist.rows)
      ? partnerWorkbench.pilotReadinessChecklist.rows
      : [],
    partnerWorkbenchPilotDisplayRows: partnerWorkbench && partnerWorkbench.pilotReadinessChecklist && Array.isArray(partnerWorkbench.pilotReadinessChecklist.rows)
      ? formatPartnerPilotRows(partnerWorkbench.pilotReadinessChecklist.rows)
      : [],
    partnerWorkbenchRevenueMilestones: partnerWorkbench && Array.isArray(partnerWorkbench.revenueMilestones) ? partnerWorkbench.revenueMilestones : [],
    partnerWorkbenchRevenueDisplayRows: partnerWorkbench && Array.isArray(partnerWorkbench.revenueMilestones) ? formatRevenueMilestones(partnerWorkbench.revenueMilestones) : [],
    partnerPilotDeliveryPacket: partnerWorkbench ? partnerWorkbench.pilotDeliveryPacket : null,
    partnerPilotDeliveryRows: partnerWorkbench && partnerWorkbench.pilotDeliveryPacket ? formatPartnerDeliveryRows(partnerWorkbench.pilotDeliveryPacket.deliveryRows) : [],
    partnerPilotTalkTrack: partnerWorkbench && partnerWorkbench.pilotDeliveryPacket && Array.isArray(partnerWorkbench.pilotDeliveryPacket.partnerTalkTrack)
      ? partnerWorkbench.pilotDeliveryPacket.partnerTalkTrack
      : [],
    partnerPilotBlockedPromises: partnerWorkbench && partnerWorkbench.pilotDeliveryPacket && Array.isArray(partnerWorkbench.pilotDeliveryPacket.blockedPromises)
      ? formatPartnerFieldList(partnerWorkbench.pilotDeliveryPacket.blockedPromises)
      : '',
    partnerWorkbenchPrivacyGate: partnerWorkbench ? partnerWorkbench.privacyGate : null,
    partnerServiceReviewCard,
    partnerServiceReviewTitle: partnerServiceReviewCard ? partnerServiceReviewCard.title : '',
    partnerServiceReviewStatusLine: partnerServiceReviewCard ? partnerServiceReviewCard.statusLine : '',
    partnerServiceReviewDecisionLine: partnerServiceReviewCard ? partnerServiceReviewCard.decisionLine : '',
    partnerServiceReviewEvidenceLine: partnerServiceReviewCard ? partnerServiceReviewCard.evidenceLine : '',
    partnerServiceReviewNextActionLine: partnerServiceReviewCard ? partnerServiceReviewCard.nextActionLine : '',
    partnerServiceReviewReleaseLine: partnerServiceReviewCard ? partnerServiceReviewCard.releaseLine : '',
    partnerServiceReviewActions: partnerServiceReviewCard ? partnerServiceReviewCard.actions : [],
    uploadedMaterialDeliveryView,
    uploadedMaterialServiceHandoffPack,
    uploadedMaterialServiceHandoffTitle: uploadedMaterialServiceHandoffPack ? uploadedMaterialServiceHandoffPack.title : '',
    uploadedMaterialServiceHandoffSummary: uploadedMaterialServiceHandoffPack ? uploadedMaterialServiceHandoffPack.summaryLine : '',
    uploadedMaterialServiceHandoffCards: uploadedMaterialServiceHandoffPack ? uploadedMaterialServiceHandoffPack.cards : [],
    uploadedMaterialServiceHandoffReleaseLine: uploadedMaterialServiceHandoffPack ? uploadedMaterialServiceHandoffPack.releaseLine : '',
    uploadedMaterialServiceHandoffBlockedLine: uploadedMaterialServiceHandoffPack ? uploadedMaterialServiceHandoffPack.blockedLine : '',
    uploadedMaterialServiceHandoffActions,
    uploadedMaterialDecisionDossier,
    uploadedMaterialDecisionDossierHandoff: uploadedMaterialReportHandoff || null,
    uploadedMaterialDecisionDossierHandoffTitle: uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.title ? uploadedMaterialReportHandoff.title : '',
    uploadedMaterialDecisionDossierHandoffLine: uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.line ? uploadedMaterialReportHandoff.line : '',
    uploadedMaterialDecisionDossierHandoffReportId: uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.reportId ? uploadedMaterialReportHandoff.reportId : '',
    uploadedMaterialDecisionDossierHandoffSourceSchemaId: uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.sourceSchemaId ? uploadedMaterialReportHandoff.sourceSchemaId : '',
    personalizedParentReportPreview,
    personalizedParentReportTitle: personalizedParentReportPreview ? personalizedParentReportPreview.title || '家长个性化学习报告' : '',
    personalizedParentReportStandardVersion: personalizedParentReportPreview
      ? personalizedParentReportPreview.standardVersion || (personalizedParentReportStandard && personalizedParentReportStandard.version) || ''
      : '',
    personalizedParentReportFormat: personalizedParentReportPreview ? personalizedParentReportPreview.format || 'html_preview_printable_pdf' : '',
    personalizedParentReportHtmlLength: personalizedParentReportPreview ? Number(personalizedParentReportPreview.htmlLength || 0) : 0,
    personalizedParentReportExportLine: reportState.reportExportLine
      || draft.reportExportLine
      || (uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.reportExportLine)
      || (personalizedParentReportExportPolicy && (personalizedParentReportExportPolicy.miniappLine || personalizedParentReportExportPolicy.printRule))
      || '',
    personalizedParentReportPrintRule: personalizedParentReportExportPolicy ? personalizedParentReportExportPolicy.printRule || '' : '',
    personalizedParentReportStandardCases: personalizedParentReportStandard && Array.isArray(personalizedParentReportStandard.materialCases)
      ? personalizedParentReportStandard.materialCases.map((item) => ({
        id: item.id,
        label: item.label,
        output: item.output
      }))
      : [],
    personalizedParentReportSelectedCaseIds: personalizedParentReportStandard && personalizedParentReportStandard.evidenceProtocol && Array.isArray(personalizedParentReportStandard.evidenceProtocol.selectedCaseIds)
      ? personalizedParentReportStandard.evidenceProtocol.selectedCaseIds
      : [],
    personalizedParentReportQualityGates: personalizedParentReportStandard && Array.isArray(personalizedParentReportStandard.qualityGates)
      ? personalizedParentReportStandard.qualityGates
      : [],
    personalizedParentReportSop: personalizedParentReportStandard && personalizedParentReportStandard.reportSop
      ? personalizedParentReportStandard.reportSop
      : null,
    personalizedParentReportCompetitorBenchmarks: personalizedParentReportStandard && Array.isArray(personalizedParentReportStandard.competitorClosureBenchmarks)
      ? personalizedParentReportStandard.competitorClosureBenchmarks.map((item) => ({
        id: item.id,
        outsideLine: item.benchmark || '',
        productAnswer: item.productAnswer || '',
        route: item.route || '',
        evidenceReturn: item.evidenceReturn || ''
      }))
      : [],
    personalizedParentReportMiniappPlan: personalizedParentReportStandard && personalizedParentReportStandard.miniappOperationalPlan
      ? personalizedParentReportStandard.miniappOperationalPlan
      : null,
    uploadedMaterialDecisionDossierTitle: uploadedMaterialDecisionDossier.title || '',
    uploadedMaterialDecisionDossierSummary: uploadedMaterialDecisionDossier.summary || '',
    uploadedMaterialDecisionDossierReportUseRule: uploadedMaterialDecisionDossier.reportUseRule || '',
    uploadedMaterialDecisionDossierTalentRule: uploadedMaterialDecisionDossier.talentRule || '',
    uploadedMaterialDecisionDossierWrongPaperRule: uploadedMaterialDecisionDossier.wrongPaperRule || '',
    uploadedMaterialDecisionDossierSchoolRule: uploadedMaterialDecisionDossier.schoolRule || '',
    uploadedMaterialDecisionDossierChildStrengthLine: uploadedMaterialDecisionDossier.childStrengthLine || '',
    uploadedMaterialDecisionDossierHowToLearnBetter: Array.isArray(uploadedMaterialDecisionDossier.howToLearnBetter) ? uploadedMaterialDecisionDossier.howToLearnBetter : [],
    uploadedMaterialDecisionDossierMethodCandidateCards: Array.isArray(uploadedMaterialDecisionDossier.methodCandidateCards) ? uploadedMaterialDecisionDossier.methodCandidateCards : [],
    uploadedMaterialDecisionDossierDecisionHeatmap: Array.isArray(uploadedMaterialDecisionDossier.decisionHeatmap) ? uploadedMaterialDecisionDossier.decisionHeatmap : [],
    uploadedMaterialDecisionDossierFamilyActionStack: Array.isArray(uploadedMaterialDecisionDossier.familyActionStack) ? uploadedMaterialDecisionDossier.familyActionStack : [],
    uploadedMaterialDecisionDossierAiQualityGate: uploadedMaterialDecisionDossier.aiAnalysisQualityGate || null,
    uploadedMaterialDecisionDossierAiQualityLine: uploadedMaterialDecisionDossier.aiQualityLine || '',
    uploadedMaterialDecisionDossierAiQualityPlan: Array.isArray(uploadedMaterialDecisionDossier.aiQualityValidationPlan) ? uploadedMaterialDecisionDossier.aiQualityValidationPlan : [],
    uploadedMaterialDecisionDossierPrivateTutorSolutionPack: uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack || null,
    uploadedMaterialDecisionDossierPrivateTutorModeOrchestration: uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack && Array.isArray(uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.modeOrchestration)
      ? uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.modeOrchestration
      : [],
    uploadedMaterialDecisionDossierPrivateTutorDeliveryLoop: uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack && Array.isArray(uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.deliveryLoop)
      ? uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.deliveryLoop
      : [],
    uploadedMaterialDecisionDossierPrivateTutorSourceMap: uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack && Array.isArray(uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.sourceToPlanMap)
      ? uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.sourceToPlanMap
      : [],
    uploadedMaterialDecisionDossierPrivateTutorMoatSignals: uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack && Array.isArray(uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.moatSignals)
      ? uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.moatSignals
      : [],
    uploadedMaterialDecisionDossierSolutionBlueprint: uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint || null,
    reportRevisitEvidence,
    reportRevisitValidationStage: reportState.reportRevisitEvidence ? reportState.reportRevisitEvidence.validationStage : '',
    reportRevisitLongTermPortraitRelease: reportState.reportRevisitEvidence ? reportState.reportRevisitEvidence.longTermPortraitRelease : '',
    reportRevisitNextDayCount: reportState.reportRevisitEvidence ? Number(reportState.reportRevisitEvidence.nextDayRevisitCount || 0) : 0,
    reportRevisitDay7Ready: reportState.reportRevisitEvidence ? !!reportState.reportRevisitEvidence.day7VariantReady : false,
    reportRevisitLocalRule: reportState.reportRevisitEvidence ? reportState.reportRevisitEvidence.localRule || '' : '',
    uploadedMaterialDecisionDossierSolutionModeSequence: uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint && Array.isArray(uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.modeSequence)
      ? uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.modeSequence
      : [],
    uploadedMaterialDecisionDossierSolutionFusionRules: uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint && Array.isArray(uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.evidenceFusionRules)
      ? uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.evidenceFusionRules
      : [],
    uploadedMaterialDecisionDossierSolutionOwnership: uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint && Array.isArray(uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.localVsAiOwnership)
      ? uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.localVsAiOwnership
      : [],
    uploadedMaterialDecisionDossierFamilyDecisionCalendar: uploadedMaterialDecisionDossier.familyDecisionCalendar || null,
    uploadedMaterialDecisionDossierFamilyDecisionWeeks: uploadedMaterialDecisionDossier.familyDecisionCalendar && Array.isArray(uploadedMaterialDecisionDossier.familyDecisionCalendar.weeks)
      ? uploadedMaterialDecisionDossier.familyDecisionCalendar.weeks
      : [],
    uploadedMaterialDecisionDossierMonthlyReview: uploadedMaterialDecisionDossier.familyDecisionCalendar && uploadedMaterialDecisionDossier.familyDecisionCalendar.monthlyReview
      ? uploadedMaterialDecisionDossier.familyDecisionCalendar.monthlyReview
      : null,
    uploadedMaterialDecisionDossierMethodologyGuide: uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide || null,
    uploadedMaterialDecisionDossierMethodologyGuideTitle: uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide ? uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.title || '' : '',
    uploadedMaterialDecisionDossierMethodologyGuideSummary: uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide ? uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.summary || '' : '',
    uploadedMaterialDecisionDossierMethodologyGuidePrimary: uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide ? uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.primaryRecommendation || '' : '',
    uploadedMaterialDecisionDossierMethodologyGuideServiceMode: uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide ? uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.serviceModeLine || '' : '',
    uploadedMaterialDecisionDossierMethodologyCards: uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide && Array.isArray(uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.cards)
      ? uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.cards
      : [],
    uploadedMaterialDecisionDossierMethodologyRules: uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide && Array.isArray(uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.reportWritingRules)
      ? uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.reportWritingRules
      : [],
    uploadedMaterialDecisionDossierWrongPaperDiagnosisCards: Array.isArray(uploadedMaterialDecisionDossier.wrongPaperDiagnosisCards) ? uploadedMaterialDecisionDossier.wrongPaperDiagnosisCards : [],
    uploadedMaterialDecisionDossierMethodValidationStages: Array.isArray(uploadedMaterialDecisionDossier.methodValidationStages) ? uploadedMaterialDecisionDossier.methodValidationStages : [],
    uploadedMaterialDecisionDossierMethodValidationReleaseRule: uploadedMaterialDecisionDossier.methodValidationReleaseRule || '',
    uploadedMaterialDecisionDossierMethodValidationNextAction: uploadedMaterialDecisionDossier.methodValidationNextAction || '',
    uploadedMaterialDecisionDossierDetailedSections: Array.isArray(uploadedMaterialDecisionDossier.detailedReportSections) ? uploadedMaterialDecisionDossier.detailedReportSections : [],
    uploadedMaterialDecisionDossierMaterialLanes: Array.isArray(uploadedMaterialDecisionDossier.materialLanes) ? uploadedMaterialDecisionDossier.materialLanes : [],
    uploadedMaterialDecisionDossierNextEvidenceQueue: Array.isArray(uploadedMaterialDecisionDossier.nextEvidenceQueue) ? uploadedMaterialDecisionDossier.nextEvidenceQueue : [],
    uploadedMaterialDecisionDossierParentDecisionSections: Array.isArray(uploadedMaterialDecisionDossier.parentDecisionSections) ? uploadedMaterialDecisionDossier.parentDecisionSections : [],
    uploadedMaterialDecisionDossierAiLocalSplit: Array.isArray(uploadedMaterialDecisionDossier.aiLocalSplit) ? uploadedMaterialDecisionDossier.aiLocalSplit : [],
    uploadedMaterialDecisionDossierReleaseGate: uploadedMaterialDecisionDossier.releaseGate || null,
    uploadedMaterialDecisionDossierShareSafePayload: uploadedMaterialDecisionDossier.shareSafePayload || null,
    uploadedMaterialDecisionDossierRouteActions: []
      .concat(uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.actionRoute
        ? [{
          id: 'handoff_primary',
          label: uploadedMaterialReportHandoff.actionLabel || '去处理',
          route: uploadedMaterialReportHandoff.actionRoute,
          reason: uploadedMaterialReportHandoff.line || '来自刚上传资料的下一步'
        }]
        : [])
      .concat(uploadedMaterialReportHandoff && uploadedMaterialReportHandoff.gameRoute
        ? [{
          id: 'handoff_game',
          label: '去轻练习',
          route: uploadedMaterialReportHandoff.gameRoute,
          reason: '把刚上传资料转成一次主动回忆'
        }]
        : [])
      .concat(Array.isArray(uploadedMaterialDecisionDossier.routeActions) ? uploadedMaterialDecisionDossier.routeActions : []),
    uploadedMaterialDecisionDossierEvidenceRequired: Array.isArray(uploadedMaterialDecisionDossier.evidenceRequired) ? uploadedMaterialDecisionDossier.evidenceRequired : [],
    portraitConfidenceTitle: portraitConfidenceSystem.title || '',
    portraitConfidenceLevel: portraitConfidenceSystem.confidenceLevel || '',
    portraitConfidenceScore: Number(portraitConfidenceSystem.evidenceScore || 0),
    portraitConfidenceSummary: portraitConfidenceSystem.summary || '',
    portraitConfidenceLedger: Array.isArray(portraitConfidenceSystem.evidenceLedger) ? portraitConfidenceSystem.evidenceLedger : [],
    portraitDecisionThresholds: Array.isArray(portraitConfidenceSystem.decisionThresholds) ? portraitConfidenceSystem.decisionThresholds : [],
    portraitObservationCadence: Array.isArray(portraitConfidenceSystem.observationCadence) ? portraitConfidenceSystem.observationCadence : [],
    portraitParentTrustContract: portraitConfidenceSystem.parentTrustContract || null,
    portraitConfidenceEscalationRule: portraitConfidenceSystem.escalationRule || '',
    portraitConfidenceFamilyDecisionLine: portraitConfidenceSystem.familyDecisionLine || '',
    parentDecisionTrustTitle: parentDecisionTrustSystem.title || '',
    parentDecisionTrustLevel: parentDecisionTrustSystem.level || '',
    parentDecisionTrustScore: Number(parentDecisionTrustSystem.score || 0),
    parentDecisionTrustLine: parentDecisionTrustSystem.decisionLine || '',
    parentDecisionTrustDeck: Array.isArray(parentDecisionTrustSystem.decisionDeck) ? parentDecisionTrustSystem.decisionDeck : [],
    parentDecisionTrustGuardrails: Array.isArray(parentDecisionTrustSystem.guardrails) ? parentDecisionTrustSystem.guardrails : [],
    parentDecisionTrustGaps: Array.isArray(parentDecisionTrustSystem.evidenceGaps) ? parentDecisionTrustSystem.evidenceGaps : [],
    parentDecisionTrustWeeklyReview: Array.isArray(parentDecisionTrustSystem.weeklyDecisionReview) ? parentDecisionTrustSystem.weeklyDecisionReview : [],
    parentDecisionTrustShareBoundary: parentDecisionTrustSystem.shareBoundary || '',
    socraticMemoryReportBridge,
    socraticMemoryReportTitle: socraticMemoryReportBridge ? socraticMemoryReportBridge.title : '',
    socraticMemoryReportStatus: socraticMemoryReportBridge ? socraticMemoryReportBridge.status : '',
    socraticMemoryReportSummary: socraticMemoryReportBridge ? socraticMemoryReportBridge.summary : '',
    socraticMemoryReportPrimaryAction: socraticMemoryReportBridge ? socraticMemoryReportBridge.primaryActionLine : '',
    socraticMemoryReportDecisionLine: socraticMemoryReportBridge ? socraticMemoryReportBridge.reportDecisionLine : '',
    socraticMemoryReportNoIncreaseRule: socraticMemoryReportBridge ? socraticMemoryReportBridge.noIncreaseRule : '',
    socraticMemoryReportParentProofLine: socraticMemoryReportBridge ? socraticMemoryReportBridge.parentProofLine : '',
    socraticMemoryReportShareBoundary: socraticMemoryReportBridge ? socraticMemoryReportBridge.shareBoundary : '',
    socraticMemoryReportActions: socraticMemoryReportBridge && Array.isArray(socraticMemoryReportBridge.reportActions)
      ? socraticMemoryReportBridge.reportActions
      : [],
    socraticMemoryReportEvidence: socraticMemoryReportBridge && Array.isArray(socraticMemoryReportBridge.evidenceRequired)
      ? socraticMemoryReportBridge.evidenceRequired
      : [],
    socraticPromptQualityJudge,
    socraticPromptJudgeTitle: socraticPromptQualityJudge ? socraticPromptQualityJudge.title : '',
    socraticPromptJudgeSummary: socraticPromptQualityJudge ? socraticPromptQualityJudge.summary : '',
    socraticPromptEffectivePrompts: socraticPromptQualityJudge && Array.isArray(socraticPromptQualityJudge.effectivePrompts)
      ? socraticPromptQualityJudge.effectivePrompts
      : [],
    socraticPromptMisleadingPrompts: socraticPromptQualityJudge && Array.isArray(socraticPromptQualityJudge.misleadingPrompts)
      ? socraticPromptQualityJudge.misleadingPrompts
      : [],
    socraticPromptStopConditions: socraticPromptQualityJudge && Array.isArray(socraticPromptQualityJudge.stopConditions)
      ? socraticPromptQualityJudge.stopConditions
      : [],
    socraticPromptParentRules: socraticPromptQualityJudge && Array.isArray(socraticPromptQualityJudge.parentDecisionRules)
      ? socraticPromptQualityJudge.parentDecisionRules
      : [],
    socraticPromptParentDecisionLine: socraticPromptQualityJudge ? socraticPromptQualityJudge.parentDecisionLine : '',
    socraticPromptShareBoundary: socraticPromptQualityJudge ? socraticPromptQualityJudge.shareBoundary : '',
    socraticPromptJudgeEvidence: socraticPromptQualityJudge && Array.isArray(socraticPromptQualityJudge.evidenceRequired)
      ? socraticPromptQualityJudge.evidenceRequired
      : [],
    questionBankDecisionBridge,
    questionBankDecisionTitle: questionBankDecisionBridge ? questionBankDecisionBridge.title : '',
    questionBankDecisionStatus: questionBankDecisionBridge ? questionBankDecisionBridge.status : '',
    questionBankDecisionSummary: questionBankDecisionBridge ? questionBankDecisionBridge.summary : '',
    questionBankDecisionLine: questionBankDecisionBridge ? questionBankDecisionBridge.decisionLine : '',
    questionBankDecisionParentAction: questionBankDecisionBridge ? questionBankDecisionBridge.parentActionLine : '',
    questionBankDecisionXpGate: questionBankDecisionBridge ? questionBankDecisionBridge.xpGate : '',
    questionBankDecisionConfidenceLine: questionBankDecisionBridge ? questionBankDecisionBridge.confidenceLine : '',
    questionBankDecisionDeck: questionBankDecisionBridge && Array.isArray(questionBankDecisionBridge.activeDeck)
      ? questionBankDecisionBridge.activeDeck
      : [],
    questionBankDecisionReviewWindows: questionBankDecisionBridge && Array.isArray(questionBankDecisionBridge.reviewWindows)
      ? questionBankDecisionBridge.reviewWindows
      : [],
    questionBankDecisionEvidence: questionBankDecisionBridge && Array.isArray(questionBankDecisionBridge.evidenceRequired)
      ? questionBankDecisionBridge.evidenceRequired
      : [],
    questionBankRecallReportBridge,
    questionBankRecallReportTitle: questionBankRecallReportBridge ? questionBankRecallReportBridge.title : '',
    questionBankRecallReportStatus: questionBankRecallReportBridge ? questionBankRecallReportBridge.status : '',
    questionBankRecallReportSummary: questionBankRecallReportBridge ? questionBankRecallReportBridge.summary : '',
    questionBankRecallReportPortraitDecision: questionBankRecallReportBridge ? questionBankRecallReportBridge.portraitDecisionLine : '',
    questionBankRecallReportParentAction: questionBankRecallReportBridge ? questionBankRecallReportBridge.parentActionLine : '',
    questionBankRecallReportNoCramRule: questionBankRecallReportBridge ? questionBankRecallReportBridge.noCramRule : '',
    questionBankRecallReportShareBoundary: questionBankRecallReportBridge ? questionBankRecallReportBridge.shareBoundary : '',
    questionBankRecallReportIntensityLine: questionBankRecallReportBridge ? questionBankRecallReportBridge.intensityLine : '',
    questionBankRecallReportReturnWindowLine: questionBankRecallReportBridge ? questionBankRecallReportBridge.returnWindowLine : '',
    questionBankRecallReportGreenWordLine: questionBankRecallReportBridge ? questionBankRecallReportBridge.greenWordLine : '',
    questionBankRecallReportGreenWordCards: questionBankRecallReportBridge && Array.isArray(questionBankRecallReportBridge.greenWordCards)
      ? questionBankRecallReportBridge.greenWordCards
      : [],
    questionBankRecallReportGreenWordModes: questionBankRecallReportBridge && Array.isArray(questionBankRecallReportBridge.greenWordModes)
      ? questionBankRecallReportBridge.greenWordModes
      : [],
    questionBankRecallReportCards: questionBankRecallReportBridge && Array.isArray(questionBankRecallReportBridge.workoutCards)
      ? questionBankRecallReportBridge.workoutCards
      : [],
    questionBankRecallReportPhases: questionBankRecallReportBridge && Array.isArray(questionBankRecallReportBridge.phases)
      ? questionBankRecallReportBridge.phases
      : [],
    questionBankRecallReportEvidence: questionBankRecallReportBridge && Array.isArray(questionBankRecallReportBridge.evidenceRequired)
      ? questionBankRecallReportBridge.evidenceRequired
      : [],
    gameReturnEvidence,
    gameReturnEvidenceStatus: gameReturnEvidence ? gameReturnEvidence.status : '',
    gameReturnEvidenceWeakKey: gameReturnEvidence ? gameReturnEvidence.weakKey : '',
    gameReturnEvidenceNextRoute: gameReturnEvidence ? gameReturnEvidence.nextRoute : '',
    gameReturnEvidenceReleaseGate: gameReturnEvidence ? gameReturnEvidence.releaseGate : '',
    gameReturnEvidenceDay7Requirement: gameReturnEvidence ? gameReturnEvidence.day7Requirement : '',
    gameReturnEvidenceReturnWindows: gameReturnEvidence && Array.isArray(gameReturnEvidence.returnWindows)
      ? gameReturnEvidence.returnWindows
      : [],
    gameReturnEvidenceNextDayCardIds: gameReturnEvidence && Array.isArray(gameReturnEvidence.nextDayCardIds)
      ? gameReturnEvidence.nextDayCardIds
      : [],
    gameReturnEvidenceBlockedFields: gameReturnEvidence && Array.isArray(gameReturnEvidence.blockedFields)
      ? gameReturnEvidence.blockedFields
      : [],
    gameReturnEvidenceAllowedFields: gameReturnEvidence && Array.isArray(gameReturnEvidence.allowedFields)
      ? gameReturnEvidence.allowedFields
      : [],
    gameReturnEvidenceLocalCodeOwns: gameReturnEvidence && Array.isArray(gameReturnEvidence.localCodeOwns)
      ? gameReturnEvidence.localCodeOwns
      : [],
    gameReturnEvidenceAiMayRewrite: gameReturnEvidence && Array.isArray(gameReturnEvidence.aiMayRewrite)
      ? gameReturnEvidence.aiMayRewrite
      : [],
    gameReturnEvidenceRequired: gameReturnEvidence && Array.isArray(gameReturnEvidence.evidenceRequired)
      ? gameReturnEvidence.evidenceRequired
      : [],
    memoryRiskReleaseModel,
    memoryRiskReleaseTitle: memoryRiskReleaseModel ? memoryRiskReleaseModel.title : '',
    memoryRiskReleaseLevel: memoryRiskReleaseModel ? memoryRiskReleaseModel.level : '',
    memoryRiskReleaseSummary: memoryRiskReleaseModel ? memoryRiskReleaseModel.summary : '',
    memoryRiskSignals: memoryRiskReleaseModel && Array.isArray(memoryRiskReleaseModel.riskSignals)
      ? memoryRiskReleaseModel.riskSignals
      : [],
    memoryForgettingWarnings: memoryRiskReleaseModel && Array.isArray(memoryRiskReleaseModel.forgettingWarnings)
      ? memoryRiskReleaseModel.forgettingWarnings
      : [],
    memoryVariantReleaseGates: memoryRiskReleaseModel && Array.isArray(memoryRiskReleaseModel.variantReleaseGates)
      ? memoryRiskReleaseModel.variantReleaseGates
      : [],
    memoryRiskParentDecisionLine: memoryRiskReleaseModel ? memoryRiskReleaseModel.parentDecisionLine : '',
    memoryRiskXpReleaseLine: memoryRiskReleaseModel ? memoryRiskReleaseModel.xpReleaseLine : '',
    memoryRiskShareBoundary: memoryRiskReleaseModel ? memoryRiskReleaseModel.shareBoundary : '',
    memoryRiskEvidence: memoryRiskReleaseModel && Array.isArray(memoryRiskReleaseModel.evidenceRequired)
      ? memoryRiskReleaseModel.evidenceRequired
      : [],
    portraitDecisionReleaseSystem,
    portraitDecisionReleaseTitle: portraitDecisionReleaseSystem ? portraitDecisionReleaseSystem.title : '',
    portraitDecisionReleaseLevel: portraitDecisionReleaseSystem ? portraitDecisionReleaseSystem.releaseLevel : '',
    portraitDecisionReleaseScore: portraitDecisionReleaseSystem ? Number(portraitDecisionReleaseSystem.releaseScore || 0) : 0,
    portraitDecisionReleaseSummary: portraitDecisionReleaseSystem ? portraitDecisionReleaseSystem.summary : '',
    portraitDecisionReleaseLanes: portraitDecisionReleaseSystem && Array.isArray(portraitDecisionReleaseSystem.releaseLanes)
      ? portraitDecisionReleaseSystem.releaseLanes.map((item) => Object.assign({}, item, {
        readableLine: `${item.label || '家庭动作'}：${item.status === 'released' ? '可以今晚执行' : item.status === 'candidate' ? '作为候选继续验证' : '暂时锁住'}；依据：${item.releaseRule || '等孩子第一步、错因和回访证据补齐'}；不做：${item.blockedRule || '不贴长期标签'}`
      }))
      : [],
    portraitDecisionReleaseLocks: portraitDecisionReleaseSystem && Array.isArray(portraitDecisionReleaseSystem.releaseLocks)
      ? portraitDecisionReleaseSystem.releaseLocks
      : [],
    portraitDecisionReleaseQueue: portraitDecisionReleaseSystem && Array.isArray(portraitDecisionReleaseSystem.actionQueue)
      ? portraitDecisionReleaseSystem.actionQueue
      : [],
    portraitDecisionReleaseParentLine: portraitDecisionReleaseSystem ? portraitDecisionReleaseSystem.parentDecisionLine : '',
    portraitDecisionReleaseXpLine: portraitDecisionReleaseSystem ? portraitDecisionReleaseSystem.xpReleaseLine : '',
    portraitDecisionReleaseShareBoundary: portraitDecisionReleaseSystem ? portraitDecisionReleaseSystem.shareBoundary : '',
    portraitDecisionReleaseEvidence: portraitDecisionReleaseSystem && Array.isArray(portraitDecisionReleaseSystem.evidenceRequired)
      ? portraitDecisionReleaseSystem.evidenceRequired
      : [],
    fallbackRecoveryReportBridge,
    fallbackRecoveryTitle: fallbackRecoveryReportBridge ? fallbackRecoveryReportBridge.title : '',
    fallbackRecoveryReportLine: fallbackRecoveryReportBridge ? fallbackRecoveryReportBridge.reportLine : '',
    fallbackRecoveryNextAction: fallbackRecoveryReportBridge ? fallbackRecoveryReportBridge.nextSmallAction : '',
    fallbackRecoveryParentDecision: fallbackRecoveryReportBridge ? fallbackRecoveryReportBridge.parentDecisionLine : '',
    fallbackRecoveryShareBoundary: fallbackRecoveryReportBridge ? fallbackRecoveryReportBridge.shareBoundary : '',
    fallbackRecoverySequence: fallbackRecoveryReportBridge && Array.isArray(fallbackRecoveryReportBridge.recoverySequence)
      ? fallbackRecoveryReportBridge.recoverySequence
      : [],
    fallbackRecoveryEvidence: fallbackRecoveryReportBridge && Array.isArray(fallbackRecoveryReportBridge.evidenceRequired)
      ? fallbackRecoveryReportBridge.evidenceRequired
      : [],
    familyDecisionHomepage,
    tonightParentDecisionCard,
    tonightParentDecisionCardRows: tonightParentDecisionCard.rows,
    tonightParentDecisionCardRoute: tonightParentDecisionCard.route,
    tonightParentDecisionCardCtaLabel: tonightParentDecisionCard.ctaLabel,
    familyDecisionHomepageTitle: familyDecisionHomepage.title,
    familyDecisionHomepageHeadline: familyDecisionHomepage.headline,
    familyDecisionHomepageStatus: familyDecisionHomepage.status,
    familyDecisionHomepagePrimaryAction: familyDecisionHomepage.primaryAction,
    familyDecisionHomepageParentQuestion: familyDecisionHomepage.parentQuestion,
    familyDecisionHomepageChildLine: familyDecisionHomepage.childLine,
    familyDecisionHomepageTomorrow: familyDecisionHomepage.tomorrow,
    familyDecisionHomepageSourceLine: familyDecisionHomepage.sourceLine,
    familyDecisionHomepageLocalAiSplitLine: familyDecisionHomepage.localAiSplitLine,
    familyDecisionHomepageHomeSchoolLine: familyDecisionHomepage.homeSchoolLine,
    familyDecisionHomepageShareBoundary: familyDecisionHomepage.shareBoundary,
    familyDecisionHomepageDoList: familyDecisionHomepage.doList,
    familyDecisionHomepageDontList: familyDecisionHomepage.dontList,
    familyDecisionHomepageEvidenceList: familyDecisionHomepage.evidenceList,
    familyDecisionHomepageStatusSteps: familyDecisionHomepage.statusSteps,
    familyDecisionHomepagePrimaryBlocker: familyDecisionHomepage.primaryBlocker,
    familyDecisionHomepageEvidenceMissingCount: familyDecisionHomepage.evidenceMissingCount,
    familyDecisionHomepageNextLocalAction: familyDecisionHomepage.nextLocalAction,
    familyDecisionHomepageSafeShareBadges: familyDecisionHomepage.safeShareBadges,
    familyDecisionHomepageAllowedFields: familyDecisionHomepage.allowedFields,
    familyDecisionHomepageBlockedFields: familyDecisionHomepage.blockedFields,
    familyDecisionHomepageParentReceiptLine: familyDecisionHomepage.parentReceiptLine,
    familyDecisionHomepageParentReceiptReady: familyDecisionHomepage.parentReceiptReady,
    familyDecisionHomepageParentReceiptStats: familyDecisionHomepage.parentReceiptStats,
    familyDecisionHomepageRoute: familyDecisionHomepage.route,
    familyDecisionHomepageCtaLabel: familyDecisionHomepage.ctaLabel,
    familyDecisionTitle: familyDecisionMemo.title || '',
    familyDecisionTonight: familyDecisionMemo.tonightDecision || '',
    familyDecisionDoNotDo: Array.isArray(familyDecisionMemo.doNotDo) ? familyDecisionMemo.doNotDo : [],
    familyDecisionEvidenceChecklist: Array.isArray(familyDecisionMemo.evidenceChecklist) ? familyDecisionMemo.evidenceChecklist : [],
    familyDecisionParentMeetingScript: Array.isArray(familyDecisionMemo.parentMeetingScript) ? familyDecisionMemo.parentMeetingScript : [],
    familyDecisionIntakeSourcePlan: Array.isArray(familyDecisionMemo.intakeSourcePlan) ? familyDecisionMemo.intakeSourcePlan : [],
    familyDecisionPublicK12SourceStrategy: familyDecisionMemo.publicK12SourceStrategy || null,
    familyDecisionAiLocalWorkSplit: Array.isArray(familyDecisionMemo.aiLocalWorkSplit) ? familyDecisionMemo.aiLocalWorkSplit : [],
    familyDecisionCard: familyDecisionMemo.decisionCard || null,
    familyDecisionWeeklyReviewAgenda: Array.isArray(familyDecisionMemo.weeklyReviewAgenda) ? familyDecisionMemo.weeklyReviewAgenda : [],
    familyDecisionParentActionLadder: Array.isArray(familyDecisionMemo.parentActionLadder) ? familyDecisionMemo.parentActionLadder : [],
    familyDecisionSevenDayGate: familyDecisionMemo.sevenDayDecisionGate || null,
    familyDecisionShareLine: familyDecisionMemo.shareLine || '',
    tonightDecisionBrief,
    tonightDecisionTitle: tonightDecisionBrief ? tonightDecisionBrief.title : '',
    tonightDecisionHeadline: tonightDecisionBrief ? tonightDecisionBrief.headline : '',
    tonightDecisionActionLevel: tonightDecisionBrief ? tonightDecisionBrief.actionLevel : '',
    tonightDecisionSubject: tonightDecisionBrief ? tonightDecisionBrief.subject : '',
    tonightDecisionCause: tonightDecisionBrief ? tonightDecisionBrief.cause : '',
    tonightDecisionDo: tonightDecisionBrief && Array.isArray(tonightDecisionBrief.tonightDo) ? tonightDecisionBrief.tonightDo : [],
    tonightDecisionDoNot: tonightDecisionBrief && Array.isArray(tonightDecisionBrief.tonightDoNot) ? tonightDecisionBrief.tonightDoNot : [],
    tonightDecisionStopConditions: tonightDecisionBrief && Array.isArray(tonightDecisionBrief.stopConditions) ? tonightDecisionBrief.stopConditions : [],
    tonightDecisionEvidenceChecklist: tonightDecisionBrief && Array.isArray(tonightDecisionBrief.evidenceChecklist) ? tonightDecisionBrief.evidenceChecklist : [],
    tonightDecisionParentRules: tonightDecisionBrief && Array.isArray(tonightDecisionBrief.parentDecisionRules) ? tonightDecisionBrief.parentDecisionRules : [],
    tonightDecisionParentScript: tonightDecisionBrief ? tonightDecisionBrief.parentScript : '',
    tonightDecisionChildScript: tonightDecisionBrief ? tonightDecisionBrief.childScript : '',
    tonightDecisionTomorrowRevisit: tonightDecisionBrief ? tonightDecisionBrief.tomorrowRevisit : '',
    tonightDecisionReleaseGate: tonightDecisionBrief ? tonightDecisionBrief.releaseGate : '',
    tonightDecisionShareLine: tonightDecisionBrief ? tonightDecisionBrief.shareLine : '',
    tonightDecisionSharePayload: tonightDecisionBrief ? tonightDecisionBrief.sharePayload : null,
    parentDecisionBook,
    parentDecisionBookTitle: parentDecisionBook.title || '',
    parentDecisionBookDecision: parentDecisionBook.oneSentenceDecision || '',
    parentDecisionBookWhyNow: parentDecisionBook.whyNow || '',
    parentDecisionBookTomorrowCheck: parentDecisionBook.tomorrowCheck || '',
    parentDecisionBookReleaseGates: Array.isArray(parentDecisionBook.releaseGates) ? parentDecisionBook.releaseGates : [],
    parentDecisionBookRouteActions: Array.isArray(parentDecisionBook.routeActions) ? parentDecisionBook.routeActions : [],
    parentDecisionBookEvidenceRequired: Array.isArray(parentDecisionBook.evidenceRequired) ? parentDecisionBook.evidenceRequired : [],
    portraitStageLabel: reportEvidenceReleaseGate.portraitStageLabel || portraitConfidenceSystem.portraitStageLabel || '',
    portraitStageReason: portraitConfidenceSystem.portraitStageReason || '',
    portraitNextEvidenceAction: reportEvidenceReleaseGate.portraitNextEvidenceAction || portraitConfidenceSystem.portraitNextEvidenceAction || '',
    familyDecisionActionBridge,
    parentScript: solutionMap.parentScript || plan.parentLine || '家长先问一句：这一步你准备先看哪里？',
    childScript: solutionMap.childScript || plan.childLine || '我先说出第一步。',
    nextEvidenceLine: Array.isArray(solutionMap.nextEvidenceRequired) && solutionMap.nextEvidenceRequired.length
      ? solutionMap.nextEvidenceRequired.join(' · ')
      : 'child_first_step · focus_or_review_record · next_day_revisit',
    reviewTrigger: solutionMap.reviewTrigger || '7 天后用新错题或小测更新一次画像。',
    reportDailyActionQueue,
    reportTodayActionLine: reportDailyActionQueue && reportDailyActionQueue.active ? reportDailyActionQueue.active.task : '',
    reportTodayRoute: reportDailyActionQueue && reportDailyActionQueue.route ? reportDailyActionQueue.route : '',
    reportScoreReturnCard: reportDailyActionQueue && reportDailyActionQueue.scoreReportReturnCard ? reportDailyActionQueue.scoreReportReturnCard : null,
    reportScoreReturnDeck: reportDailyActionQueue && Array.isArray(reportDailyActionQueue.scoreReportReturnDeck) ? reportDailyActionQueue.scoreReportReturnDeck : [],
    reportScoreReturnLine: reportDailyActionQueue && reportDailyActionQueue.scoreReportReturnLine ? reportDailyActionQueue.scoreReportReturnLine : '',
    reportScoreReturnRoute: reportDailyActionQueue && reportDailyActionQueue.scoreReportReturnCard ? reportDailyActionQueue.scoreReportReturnCard.route : '',
    reportScoreReturnXpGate: reportDailyActionQueue && reportDailyActionQueue.scoreReportReturnCard ? reportDailyActionQueue.scoreReportReturnCard.xpGate : '',
    sevenDayActionBoard,
    sevenDayPlan: sevenDayActionBoard.days,
    missingLine: (draft.missingItems || []).slice(0, 3).join(' · '),
    tendencyLines: tendencies.slice(0, 3).map((item) => `${item.label}：${item.description}`),
    questionnaire: learningReport.buildQuickAssessmentQuestions ? learningReport.buildQuickAssessmentQuestions() : []
  };
}

function buildFamilyDecisionActionBridge(input = {}) {
  const memo = input.familyDecisionMemo || {};
  const reportQueue = input.reportDailyActionQueue || {};
  const active = reportQueue.active || {};
  const sevenDay = input.sevenDayActionBoard || {};
  const nextCapability = input.nextCapability || {};
  const subjectDepth = input.subjectSkillDepth || {};
  const visual = input.visualSocraticMatrix || {};
  const courseUnit = input.courseUnitDecisionBoard || null;
  const solutionMap = input.solutionMap || {};
  const plan = input.plan || {};
  const evidence = Array.isArray(memo.evidenceChecklist) && memo.evidenceChecklist.length
    ? memo.evidenceChecklist.slice(0, 3)
    : ['孩子说出第一步', '留下错因卡', '明天能回访同一小步'];
  const tutorRoute = memo.route || (plan.cta && plan.cta.path) || '/pages/tutor/tutor?from=family_decision_bridge';
  const practiceRoute = nextCapability.route || active.route || '/pages/arcade/arcade?from=family_decision_bridge';
  const courseUnitRoute = courseUnit && courseUnit.gameRoute ? courseUnit.gameRoute : practiceRoute;
  const subjectLine = subjectDepth && subjectDepth.label
    ? `${subjectDepth.label}：${subjectDepth.firstStep}`
    : (visual && visual.parentLine) || '第一步小黑板只看一笔，不讲完整答案。';
  const sharePath = `/pages/home/home?from=family_decision_bridge&challenge=arcade&mode=family_action&action=first_step_revisit&action_label=${encodeURIComponent('家庭决策行动桥')}&action_detail=${encodeURIComponent(memo.shareLine || sevenDay.today || '今晚只做一小步')}`;
  return {
    title: '家庭决策行动桥',
    summary: memo.tonightDecision || sevenDay.today || '报告结论要落到今晚一个动作。',
    subjectLine,
    evidenceLine: evidence.join(' / '),
    stopRule: memo.sevenDayDecisionGate && memo.sevenDayDecisionGate.reduceRule
      ? memo.sevenDayDecisionGate.reduceRule
      : '连续两次说不出第一步，就退回小黑板，不加题量。',
    actions: [
      {
        id: 'tutor',
        label: '今晚点拨',
        route: tutorRoute,
        reason: solutionMap.parentScript || sevenDay.parentScript || '先用一句追问确认孩子自己的第一步。',
        evidence: evidence[0] || '孩子说出第一步'
      },
      {
        id: 'practice',
        label: '5分钟轻练',
        route: courseUnitRoute,
        reason: courseUnit ? courseUnit.sevenDayReviewLine : (active.task || nextCapability.nextAction || '用一局轻回访确认不是当场会、转身忘。'),
        evidence: courseUnit ? courseUnit.classroomObservationLine : (evidence[1] || '留下错因卡')
      },
      {
        id: 'share',
        label: '发家庭挑战卡',
        route: sharePath,
        shareIntent: 'family_decision',
        reason: memo.shareLine || '把今晚动作发给家里，只看证据，不排行。',
        evidence: evidence[2] || '明天能回访同一小步'
      }
    ]
  };
}

function buildRecognitionSummary(draft = {}) {
  const sourceLabelMap = {
    score_sheet: '成绩资料',
    wrong_question: '错题资料',
    third_party_assessment: '测评资料',
    mixed: '混合资料'
  };
  const modeLabelMap = {
    external_api: '外部整理草稿',
    local_rules: '本地整理草稿',
    manual_text: '文字整理草稿',
    unavailable: '等待资料'
  };
  const evidence = Array.isArray(draft.evidence) ? draft.evidence : [];
  const prompts = Array.isArray(draft.confirmPrompts) ? draft.confirmPrompts : [];
  return {
    modeLabel: modeLabelMap[draft.mode] || modeLabelMap.manual_text,
    sourceLabel: sourceLabelMap[draft.sourceType] || sourceLabelMap.mixed,
    confidenceLabel: draft.confidenceLabel || (draft.confidence >= 0.78 ? '高' : draft.confidence >= 0.55 ? '中' : '低'),
    statusLine: draft.requiresConfirmation === false ? '已确认' : '草稿需家长确认',
    evidenceLine: evidence.slice(0, 3).join(' · '),
    promptLine: prompts.slice(0, 2).join(' · '),
    missingLine: (draft.missingFields || []).slice(0, 3).join(' · ')
  };
}

function buildCommercialUnlockCard(reviewSummary, tutorSummary, thinkingSummary, wrongCauseSummary) {
  const review = reviewSummary || {};
  const tutor = tutorSummary || {};
  const thinking = thinkingSummary || {};
  const wrong = wrongCauseSummary || {};
  const hasTutor = safeNumber(tutor.completed, 0) > 0 || safeNumber(thinking.total, 0) > 0;
  const hasChallenge = safeNumber(review.reviewedToday, 0) > 0 || safeNumber(review.total, 0) > 0;
  const repaired = Array.isArray(wrong.cards)
    ? wrong.cards.reduce((sum, item) => sum + safeNumber(item.count, 0), 0)
    : 0;
  const hasReview = repaired > 0 || (safeNumber(review.total, 0) > 0 && safeNumber(review.due, 0) === 0);
  const steps = [
    { id: 'tutor', label: '作业点拨', done: hasTutor },
    { id: 'challenge', label: '轻回访', done: hasChallenge },
    { id: 'review', label: '复习回访', done: hasReview }
  ];
  const done = steps.filter((item) => item.done).length;
  return {
    title: done >= 3 ? '本周复盘已可整理' : '先跑通一次完整闭环',
    body: done >= 3
      ? '你已经完成一次带学、一次轻练和一次回访，可以整理成本周复盘。'
      : '完成 1 次作业点拨 + 1 次轻练 + 1 次回访后，就能整理成本周复盘。',
    done,
    total: steps.length,
    steps,
    cta: done >= 3 ? '整理本周复盘' : '继续补齐记录',
    action: done >= 3 ? 'review' : 'arcade',
    secondaryCta: done >= 2 ? '整理本周复盘' : '',
    secondaryAction: 'lead'
  };
}

function buildProfileReadinessSnapshot(input = {}) {
  const acceptance = input.acceptance || {};
  const depth = input.learningDepthMap || {};
  const compass = input.moduleFlowCompass || {};
  const next = input.unifiedNextAction || {};
  const evidence = input.globalEvidenceBrief || {};
  const surface = input.surfaceDepthPack || {};
  const aiMatrix = acceptance.aiUsageDecisionMatrix || {};
  const finalTargetGapMeter = acceptance.finalTargetGapMeter || {};
  const competitiveMoatBoard = acceptance.competitiveMoatBoard || {};
  const aiRows = Array.isArray(aiMatrix.rows) ? aiMatrix.rows : [];
  const findAiRow = (id) => aiRows.find((item) => item && item.id === id) || {};
  const socraticAi = findAiRow('socratic_hint_generation');
  const reportAi = findAiRow('report_draft_interpretation');
  const boardAi = findAiRow('visual_blackboard_explanation');
  const localRuleRows = aiRows.filter((item) => item && item.decision === 'local_rule_required');
  const gateList = Array.isArray(acceptance.readinessGateChecklist) ? acceptance.readinessGateChecklist : [];
  const localGateList = gateList.filter((item) => item && item.id !== 'external_launch_config_clear');
  const localPassed = localGateList.length > 0 && localGateList.every((item) => item.passed);
  const externalBlocked = !!acceptance.launchBlockedByExternalConfig;
  const conclusion = localPassed
    ? (externalBlocked ? '本机闭环可试用，公开发布前还要接好正式身份与访问名单。' : '核心学习闭环已接通，可以进入真实家庭试用。')
    : '还有本地闭环待补齐，今晚先按下一步把证据补上。';
  const flowLine = compass && compass.readyCount !== undefined
    ? `${compass.readyCount} / ${compass.totalCount || 0} 个环节已接上：${compass.summary || '先跑通一次完整学习回路'}`
    : '先从作业点拨、错题修复、轻回访和家长复盘跑通一次。';
  const evidenceLine = evidence.reportLine || evidence.shareLine || surface.familyLine || depth.summary || '目前先看本机学习记录，资料越完整，建议越具体。';
  const boundaryLine = localPassed
    ? (externalBlocked ? '当前适合小范围家庭试用；公开分发前再完成正式小程序身份。' : '当前可以用真实材料做一轮家庭试用。')
    : '不承诺自动出答案，只保留第一步、回访和家长复盘证据。';
  const aiBoundaryRows = [
    {
      id: 'need_ai',
      label: '需要智能生成',
      body: `${socraticAi.label || '作业点拨追问'}：把题干、卡点和孩子原话改写成追问；本地规则先拦截直接给答案。`
    },
    {
      id: 'ai_enhanced',
      label: '可增强但不依赖',
      body: `${reportAi.label || '学习报告'}、${boardAi.label || '第一步小黑板'}可以更自然；没有智能生成时仍按证据账本给行动建议。`
    },
    {
      id: 'local_rule',
      label: '必须本地稳定',
      body: `复习调度、XP、分享隐私、家长结论和安全边界共 ${localRuleRows.length || 6} 类必须规则可跑，不能交给模型临场决定。`
    }
  ];
  const aiBoundaryReleaseRule = '即使暂时不用大模型，入口、点拨兜底、错因卡、复习、家长复盘和安全分享也必须能跑。';
  const finalTargetRows = Array.isArray(finalTargetGapMeter.rows)
    ? finalTargetGapMeter.rows.map((item) => ({
      id: item.id,
      label: item.label,
      status: item.status === 'ready' ? '已成型' : item.status === 'external_blocked' ? '差外部配置' : '还要加厚',
      progress: Number(item.progress || 0),
      route: item.route || '/pages/profile/profile',
      nextAction: item.nextAction || ''
    }))
    : [];
  const competitiveMoatRows = Array.isArray(competitiveMoatBoard.rows)
    ? competitiveMoatBoard.rows.map((item) => ({
      id: item.id,
      label: item.label,
      status: item.status === 'ready' ? '已成型' : '继续加厚',
      progress: Number(item.progress || 0),
      route: item.route || '/pages/profile/profile',
      nextAction: item.nextAction || ''
    }))
    : [];
  return {
    title: '今晚闭环状态',
    conclusion,
    flowLine,
    evidenceLine,
    nextActionLabel: next.actionLabel || '继续补一条真实材料',
    nextActionReason: next.reasonLine || (depth.nextBestAction || '让下一步有真实依据'),
    boundaryLine,
    aiBoundaryTitle: '智能能力边界',
    aiBoundarySummary: aiMatrix.principle || '高不确定解释用智能生成，确定性闭环用本地规则。',
    aiBoundaryRows,
    aiBoundaryReleaseRule,
    finalTargetTitle: finalTargetGapMeter.title || '距离竞品级商用目标',
    finalTargetScore: Number(finalTargetGapMeter.score || 0),
    finalTargetLine: finalTargetGapMeter.distanceLine || '持续按导入、点拨、回忆、画像和分享闭环补证据。',
    finalTargetRows,
    finalTargetNextAction: finalTargetGapMeter.nextAction || '继续补齐真实家庭样本和本地闭环证据。',
    finalTargetCadence: finalTargetGapMeter.reportingCadence || '每轮加厚后汇报还差多少。',
    finalTargetStopRule: finalTargetGapMeter.marginalStopRule || '边际收益低时停止堆静态资料，转向真机和真实家庭试用。',
    readyCount: depth.readyCount || compass.readyCount || 0,
    totalCount: depth.totalCount || compass.totalCount || 0,
    competitiveMoatBoardTitle: competitiveMoatBoard.title || '竞品护城河推进板',
    competitiveMoatBoardSummary: competitiveMoatBoard.summary || '',
    competitiveMoatBoardScore: Number(competitiveMoatBoard.score || 0),
    competitiveMoatBoardDistanceLine: competitiveMoatBoard.distanceLine || '',
    competitiveMoatBoardNextAction: competitiveMoatBoard.nextAction || '',
    competitiveMoatBoardCadence: competitiveMoatBoard.reportingCadence || '',
    competitiveMoatBoardStopRule: competitiveMoatBoard.marginalStopRule || '',
    competitiveMoatBoardRows: competitiveMoatRows,
    competitiveMoatBoardRoute: competitiveMoatBoard.nextRoute || ''
  };
}

Page({
  data: {
    consent: false,
    profile: {
      name: '',
      grade: '五年级',
      subject: '数学',
      minutes: 35
    },
    lead: {
      name: '',
      phone: '',
      kid: ''
    },
    identity: null,
    syncSummary: null,
    syncDiagnostics: null,
    syncReadiness: null,
    loopSummary: null,
    moduleSummary: null,
    tutorSummary: null,
    thinkingSummary: null,
    reviewSummary: null,
    profileViewModel: profileViewModels.buildProfileViewModel(),
    focusCabinSummary: focusCabin.progressSummary ? focusCabin.progressSummary() : null,
    latestFocusSession: null,
    todayFocus: null,
    tonightPlan: null,
    routeStrip: null,
    companionPreference: null,
    companionCopy: { profile: '咕点帮你整理成家长能看懂的一句话。' },
    companionLine: '咕点：我懂你卡住了，我陪你先迈出第一步。',
    weeklyGrowthMemory: null,
    tonightRouteSummary: null,
    tutorProcessSummary: null,
    calibrationProfile: null,
    parentReport: null,
    parentProofCards: [],
    parentGoals: PARENT_GOALS,
    parentGoal: PARENT_GOALS[3],
    hasParentEvidence: false,
    parentTonightItems: [],
    wrongCauseSummary: null,
    dataFlywheel: null,
    flywheelCoach: null,
    capabilityPosition: null,
    parentLoopProof: null,
    gameProfileCard: null,
    dailyShareCard: null,
    parentInviteCard: null,
    profileSafeSummary: buildProfileSafeSummary(null, [], '再用两晚后，咕点会帮你看见模式。'),
    profileEmptyGuide: '',
    weeklySummaryImagePath: '',
    developerFunnel: null,
    commercialUnlockCard: null,
    profileReadinessSnapshot: null,
    lightFeatureEvidence: null,
    parentActionGuide: storage.buildParentActionGuide ? storage.buildParentActionGuide() : null,
    learningDepthMap: storage.buildLearningDepthMap ? storage.buildLearningDepthMap() : null,
    learningQuestArc: storage.buildLearningQuestArc ? storage.buildLearningQuestArc() : null,
    moduleFlowCompass: storage.buildModuleFlowCompass ? storage.buildModuleFlowCompass() : null,
    surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('profile') : null,
    unifiedNextAction: storage.buildUnifiedNextActionController ? storage.buildUnifiedNextActionController({ surface: 'profile' }) : null,
    learningAssessment: {
      title: '孩子测评与学习方法建议',
      body: '上传一次成绩或测评描述，原点私教会把学科短板、学习方法和适合使用的能力入口放在一起看。',
      scoreInput: '',
      talentLine: '先看孩子愿意怎么想，再决定用苏格拉底、专注舱、错题修复还是轻练习。',
      methodLine: '如果总是没思路，先用咕点追问；如果坐不住，先用专注舱；如果反复错，先进错题卡点修复。',
      nextQuestion: '先说你准备从哪一步开始？',
      primaryCta: '录入成绩/测评'
    },
    learningReportState: storage.loadLearningReportState ? storage.loadLearningReportState() : null,
    learningReportSummary: buildLearningReportSummary(storage.loadLearningReportState ? storage.loadLearningReportState() : {}),
    reportDailyActionQueue: storage.buildReportDailyActionQueue ? storage.buildReportDailyActionQueue() : null,
    learningReportInput: {
      mode: 'fast',
      sourceText: '',
      profileBasics: {
        grade: '',
        age: '',
        gender: '',
        region: '',
        schoolType: ''
      },
      behaviorSignals: {
        studyMinutes: '',
        homeworkMinutes: '',
        classesCount: '',
        sleepHours: '',
        focusRating: ''
      },
      emotionSignals: {
        anxiety: '',
        communication: '',
        willingness: '',
        goalSense: ''
      },
      interestSignals: {
        tags: '',
        strengths: '',
        aspiration: ''
      },
      recognitionDraft: null
    },
    learningReportRecognitionSummary: buildRecognitionSummary({ mode: 'unavailable' }),
    learningReportQuestionnaire: learningReport.buildQuickAssessmentQuestions ? learningReport.buildQuickAssessmentQuestions() : [],
    learningReportAnswers: {},
    showLearningQuestionnaire: false,
    experienceChecklist: storage.buildExperienceChecklist ? storage.buildExperienceChecklist() : [],
    experienceDashboard: storage.calculateValidationDashboard ? storage.calculateValidationDashboard() : null,
    isBetaTester: storage.isBetaTester ? storage.isBetaTester() : false,
    isDevMode: false,
    profilePanel: 'main',
    profilePanelTitle: '',
    showGoalOptions: false,
    showAdvancedProfile: false,
    pilotSummary: null,
    shareIntent: 'peer_challenge',
    pilotForm: {
      family: '',
      minutes_saved: 15,
      confidence: 4,
      answer_blocks: 0,
      review_returned: true,
      note: ''
    },
    sending: false,
    syncing: false,
    loginText: '微信登录 / 本地会话'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    const pendingRoute = navigation.consumePendingTabRouteContext
      ? navigation.consumePendingTabRouteContext('/pages/profile/profile')
      : null;
    this.setData({
      showLegacyEntryContent: !!(pendingRoute && navigation.shouldOpenFunctionalTab(pendingRoute.options))
    });
    this.refresh();
  },

  refresh() {
    if (storage.recordProfileVisit) storage.recordProfileVisit({ source: 'profile_refresh' });
    const reviewSummary = reviewCards.reviewSummary();
    const profile = storage.loadProfile();
    const learningReportState = storage.loadLearningReportState ? storage.loadLearningReportState() : null;
    let learningReportSummary = null;
    const moduleSummary = storage.moduleEventSummary();
    const tutorSummary = storage.tutorEventSummary();
    const thinkingSummary = storage.thinkingReceiptSummary ? storage.thinkingReceiptSummary() : null;
    const thinkingReceipts = storage.loadThinkingReceipts ? storage.loadThinkingReceipts() : [];
    const tutorMessages = storage.get ? storage.get(storage.KEYS.tutorMessages, []) : [];
    const todayFocus = storage.loadTodayFocus ? storage.loadTodayFocus() : null;
    if (storage.saveTodaySession) storage.saveTodaySession({ parentRecapViewed: true });
    const tonightPlan = storage.loadTonightPlan ? storage.loadTonightPlan() : null;
    const companionPreference = storage.loadCompanionPreference ? storage.loadCompanionPreference() : null;
    const focusHistory = focusCabin.loadHistory ? focusCabin.loadHistory() : [];
    const focusCabinSummary = focusCabin.progressSummary ? focusCabin.progressSummary(focusHistory) : null;
    const factorySummary = storage.factoryEventSummary ? storage.factoryEventSummary() : null;
    const calibrationProfile = storage.familyCalibrationProfile();
    const parentGoal = storage.loadParentGoal ? storage.loadParentGoal() : PARENT_GOALS[3];
    const state = visibleLearningState();
    const plan = (state && state.homework_plan) || {};
    const hasMustTask = !!((plan.must_do || [])[0]);
    const hasParentEvidence = !!(
      hasMustTask
      || safeNumber(reviewSummary && reviewSummary.total, 0)
      || safeNumber(moduleSummary && moduleSummary.completed, 0)
      || safeNumber(tutorSummary && tutorSummary.completed, 0)
      || safeNumber(thinkingSummary && thinkingSummary.total, 0)
    );
    const gameProfileCard = buildGameProfileCard(reviewSummary);
    const wrongCauseSummary = buildWrongCauseSummary(reviewSummary, thinkingSummary);
    const globalEvidenceBrief = storage.buildGlobalEvidenceBrief ? storage.buildGlobalEvidenceBrief() : null;
    const reportDailyActionQueue = storage.buildReportDailyActionQueue ? storage.buildReportDailyActionQueue({ reportState: learningReportState || {} }) : null;
    const unifiedNextAction = storage.buildUnifiedNextActionController ? storage.buildUnifiedNextActionController({ surface: 'profile' }) : null;
    const latestThinkingReceipt = Array.isArray(thinkingReceipts) ? thinkingReceipts[0] : null;
    const subjectSkillDepth = storage.buildSubjectSkillDepth
      ? storage.buildSubjectSkillDepth(Object.assign({}, todayFocus || {}, {
        sourceText: (todayFocus && (todayFocus.stuckPointText || todayFocus.sourceText || todayFocus.thought || todayFocus.title))
          || (latestThinkingReceipt && (latestThinkingReceipt.selected_text || latestThinkingReceipt.focus))
          || '',
        firstStep: todayFocus && (todayFocus.childArticulatedStep || todayFocus.systemSuggestedStep)
      }))
      : null;
    const curriculumSpine = storage.buildCurriculumSpine
      ? storage.buildCurriculumSpine(Object.assign({}, todayFocus || {}, { subjectSkillDepth }))
      : null;
    const visualSocraticMatrix = storage.buildVisualSocraticMatrix
      ? storage.buildVisualSocraticMatrix(Object.assign({}, todayFocus || {}, { subjectSkillDepth, curriculumSpine }))
      : null;
    const courseUnitMap = storage.buildCourseUnitMap
      ? storage.buildCourseUnitMap(Object.assign({}, todayFocus || {}, { subjectSeedLibrary: null }))
      : null;
    const learningDepthMap = storage.buildLearningDepthMap ? storage.buildLearningDepthMap() : null;
    const learningQuestArc = storage.buildLearningQuestArc ? storage.buildLearningQuestArc() : null;
    const moduleFlowCompass = storage.buildModuleFlowCompass ? storage.buildModuleFlowCompass() : null;
    const surfaceDepthPack = storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('profile') : null;
    const surfaceDepthActionSummary = storage.buildSurfaceDepthActionSummary ? storage.buildSurfaceDepthActionSummary() : null;
    const lightFeatureEvidence = storage.buildLightFeatureEvidenceSummary ? storage.buildLightFeatureEvidenceSummary() : null;
    const capabilityEvidenceLedger = storage.buildCapabilityEvidenceLedger ? storage.buildCapabilityEvidenceLedger({
      globalEvidenceBrief,
      learningDepthMap,
      learningQuestArc,
      moduleFlowCompass,
      surfaceDepthActionSummary,
      lightFeatureEvidence,
      thinkingSummary
    }) : null;
    const capabilityMaturityQueue = storage.buildCapabilityMaturityQueue ? storage.buildCapabilityMaturityQueue({
      globalEvidenceBrief,
      learningQuestArc,
      moduleFlowCompass,
      capabilityEvidenceLedger
    }) : null;
    learningReportSummary = buildLearningReportSummary(learningReportState || {}, capabilityEvidenceLedger, subjectSkillDepth, curriculumSpine, visualSocraticMatrix, courseUnitMap, latestThinkingReceipt);
    const dailyShareCard = buildDailyShareCard(profile, reviewSummary, gameProfileCard, wrongCauseSummary, todayFocus, globalEvidenceBrief, reportDailyActionQueue, unifiedNextAction, capabilityEvidenceLedger, subjectSkillDepth, curriculumSpine, visualSocraticMatrix, courseUnitMap, learningReportSummary);
    const communityShareRelayBoard = storage.buildCommunityShareRelayBoard
      ? storage.buildCommunityShareRelayBoard({
        focus: todayFocus,
        dailyShareCard,
        shareChallengePlan: dailyShareCard && dailyShareCard.shareChallengePlan,
        subjectSkillDepth
      })
      : null;
    if (dailyShareCard && dailyShareCard.code && dailyShareCard.code !== lastGeneratedShareCode) {
      lastGeneratedShareCode = dailyShareCard.code;
      sendMiniEvent({
        event: 'share_card_generated',
        source: 'profile_share_card',
        entity_id: dailyShareCard.code,
        page: 'profile',
        payload: Object.assign({
          share_code: dailyShareCard.code,
          title: dailyShareCard.title
        }, buildSafeSharePayload(dailyShareCard, 'generated'))
      });
    }
    const parentReport = buildParentReport(profile, reviewSummary, moduleSummary, tutorSummary, calibrationProfile, reviewSummary.sync, thinkingSummary, parentGoal, todayFocus);
    const tutorProcessSummary = buildTutorProcessSummary(todayFocus, thinkingReceipts, tutorMessages);
    const tonightRouteSummary = buildTonightRouteSummary(tonightPlan, todayFocus, reviewSummary);
    const todayFocusReviewCards = storage.loadReviewCards
      ? storage.loadReviewCards().filter((card) => card && (card.source === 'today_focus' || card.sourceFocusId === (todayFocus && todayFocus.id)))
      : [];
    const weeklyGrowthMemory = storage.buildWeeklyGrowthMemory ? storage.buildWeeklyGrowthMemory(companionPreference) : null;
    const recentLearningSummary = storage.buildRecentLearningSummary ? storage.buildRecentLearningSummary() : null;
    const profileViewModel = profileViewModels.buildProfileViewModel({
      companionPreference,
      todayFocus,
      reviewCard: todayFocusReviewCards[0] || null,
      reviewCards: todayFocusReviewCards,
      growthMemory: weeklyGrowthMemory,
      reviewEvents: storage.loadReviewEvents ? storage.loadReviewEvents() : [],
      latestFocusSession: focusHistory[0] || null,
      focusHistory,
      focusCabinSummary,
      recentLearningSummary
    });
    const parentActionGuide = storage.buildParentActionGuide ? storage.buildParentActionGuide({
      tonightRecap: profileViewModel.parentRecap && profileViewModel.parentRecap.tonightRecap
    }) : null;
    const acceptanceReport = storage.buildAcceptanceReport ? storage.buildAcceptanceReport({ surface: 'profile' }) : null;
    const profileReadinessSnapshot = buildProfileReadinessSnapshot({
      acceptance: acceptanceReport,
      learningDepthMap,
      moduleFlowCompass,
      unifiedNextAction,
      globalEvidenceBrief,
      surfaceDepthPack
    });
    const profileEmptyGuide = hasParentEvidence
      ? ''
      : '再用两晚，咕点会帮你看见孩子常卡在哪一步。今晚先记录一句自己的第一步就够了。';
    const profileSafeSummary = buildProfileSafeSummary(todayFocus, focusHistory, profileEmptyGuide);
    const localAnalytics = storage.localAnalyticsDashboard ? storage.localAnalyticsDashboard() : null;
    this.setData({
      profile,
      consent: !!storage.get(storage.KEYS.consent, false),
      identity: storage.loadClientIdentity(),
      syncSummary: reviewSummary.sync,
      loopSummary: reviewSummary.loop,
      moduleSummary,
      tutorSummary,
      thinkingSummary,
      reviewSummary,
      profileViewModel,
      focusCabinSummary,
      latestFocusSession: focusHistory[0] || null,
      todayFocus,
      tonightPlan,
      routeStrip: buildRouteStrip('parent', tonightPlan),
      companionPreference,
      companionCopy: {
        profile: storage.getCompanionStageCopy ? storage.getCompanionStageCopy('profile_summary', companionPreference) : '咕点帮你整理成家长能看懂的一句话。'
      },
      companionLine: storage.formatCompanionLine ? storage.formatCompanionLine(companionPreference) : '咕点：我懂你卡住了，我陪你先迈出第一步。',
      weeklyGrowthMemory,
      tonightRouteSummary,
      tutorProcessSummary,
      syncDiagnostics: reviewSummary.sync && reviewSummary.sync.diagnostics,
      syncReadiness: buildSyncReadiness(storage.loadClientIdentity(), reviewSummary.sync, reviewSummary.sync && reviewSummary.sync.diagnostics),
      calibrationProfile,
      parentGoal,
      parentReport,
      parentProofCards: (parentReport.recordCards || []).filter((item) => item.id !== 'sync').slice(0, 4),
      hasParentEvidence,
      profileEmptyGuide,
      parentTonightItems: this.buildParentTonightItems(state),
      wrongCauseSummary,
      learningReportState,
      learningReportSummary,
      subjectSkillDepth,
      curriculumSpine,
      visualSocraticMatrix,
      courseUnitMap,
      reportDailyActionQueue,
      learningReportInput: Object.assign({}, this.data.learningReportInput, {
        mode: (learningReportState && learningReportState.reportProgress && learningReportState.reportProgress.mode) || this.data.learningReportInput.mode || 'fast',
        sourceText: (learningReportState && learningReportState.reportSources && learningReportState.reportSources[0] && learningReportState.reportSources[0].text) || this.data.learningReportInput.sourceText || '',
        recognitionDraft: (learningReportState && learningReportState.recognitionDraft) || this.data.learningReportInput.recognitionDraft || null,
        profileBasics: Object.assign({}, this.data.learningReportInput.profileBasics, learningReportState && learningReportState.profileBasics || {}),
        behaviorSignals: Object.assign({}, this.data.learningReportInput.behaviorSignals, learningReportState && learningReportState.behaviorSignals || {}),
        emotionSignals: Object.assign({}, this.data.learningReportInput.emotionSignals, learningReportState && learningReportState.emotionSignals || {}),
        interestSignals: Object.assign({}, this.data.learningReportInput.interestSignals, learningReportState && learningReportState.interestSignals || {})
      }),
      learningReportRecognitionSummary: buildRecognitionSummary((learningReportState && learningReportState.recognitionDraft) || (this.data.learningReportInput && this.data.learningReportInput.recognitionDraft) || { mode: 'unavailable' }),
      learningReportQuestionnaire: (learningReport.buildQuickAssessmentQuestions ? learningReport.buildQuickAssessmentQuestions() : []).map((item) => Object.assign({}, item, {
        selectedOptionId: (learningReportState && learningReportState.assessmentAnswers
          ? (learningReportState.assessmentAnswers.find((answer) => answer.id === item.id) || {}).optionId
          : '') || ''
      })),
      learningReportAnswers: (learningReportState && learningReportState.assessmentAnswers || []).reduce((acc, item) => {
        acc[item.id] = item.optionId || item.option || '';
        return acc;
      }, {}),
      dataFlywheel: this.buildDataFlywheel(reviewSummary, moduleSummary, tutorSummary, thinkingSummary, calibrationProfile, factorySummary),
      flywheelCoach: this.buildFlywheelCoach(reviewSummary, moduleSummary, tutorSummary, thinkingSummary, calibrationProfile, factorySummary, storage.pilotRunSummary ? storage.pilotRunSummary() : null),
      capabilityPosition: this.buildCapabilityPosition(reviewSummary, thinkingSummary),
      parentLoopProof: buildParentLoopProof(reviewSummary, moduleSummary, tutorSummary, thinkingSummary, factorySummary),
      gameProfileCard,
      dailyShareCard,
      communityShareRelayBoard,
      commercialUnlockCard: buildCommercialUnlockCard(reviewSummary, tutorSummary, thinkingSummary, wrongCauseSummary),
      profileReadinessSnapshot,
      capabilityEvidenceLedger,
      capabilityMaturityQueue,
      lightFeatureEvidence,
      parentActionGuide,
      learningDepthMap,
      globalEvidenceBrief,
      learningQuestArc,
      moduleFlowCompass,
      surfaceDepthPack,
      unifiedNextAction,
      surfaceDepthActionSummary,
      profileSafeSummary,
      experienceChecklist: parentActionGuide ? parentActionGuide.experienceChecklist : (storage.buildExperienceChecklist ? storage.buildExperienceChecklist() : []),
      experienceDashboard: storage.calculateValidationDashboard ? storage.calculateValidationDashboard() : null,
      developerFunnel: localAnalytics,
      isBetaTester: storage.isBetaTester ? storage.isBetaTester() : false,
      pilotSummary: storage.pilotRunSummary ? storage.pilotRunSummary() : null
    });
  },

  onLoad(options = {}) {
    if (wx.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }
    const query = options || {};
    const panel = query.panel === 'report' ? 'assessment' : (query.panel || '');
    if (query.quick_assessment === '1' || panel === 'assessment') {
      this.setData({
        profilePanel: 'assessment',
        profilePanelTitle: '测评与方法建议',
        showAdvancedProfile: true,
        showLearningQuestionnaire: query.quick_assessment === '1' ? true : this.data.showLearningQuestionnaire
      });
    }
  },

  onShareAppMessage() {
    const card = this.data.dailyShareCard || {};
    const share = resolveShareIntent(card, this.data.shareIntent);
    const title = share.title;
    const path = share.path;
    if (storage.appendShareRun) {
      storage.appendShareRun({
        code: card.code,
        title,
        path,
        type: 'share_app_message',
        share_intent: share.share_intent,
        payload: share.payload
      });
    }
    sendMiniEvent({
      event: 'share_app_message',
      source: share.share_intent,
      entity_id: card.code || '',
      page: 'profile',
      payload: {
        share_type: 'app_message',
        share_intent: share.share_intent,
        code: card.code || '',
        share_code: card.code || '',
        path,
        title,
        evidence: share.payload || {}
      }
    });
    return { title, path };
  },

  onShareTimeline() {
    const card = this.data.dailyShareCard || {};
    const share = resolveShareIntent(card, this.data.shareIntent);
    const title = share.share_intent === 'parent_card' ? (card.parentShareTitle || share.title) : (card.title || share.title);
    const query = share.path.indexOf('?') >= 0 ? share.path.split('?')[1] : `share=${card.code || 'LOCAL'}&from=timeline`;
    if (storage.appendShareRun) {
      storage.appendShareRun({
        code: card.code,
        title,
        path: `/pages/home/home?${query}`,
        type: 'share_timeline',
        share_intent: share.share_intent,
        payload: share.payload
      });
    }
    sendMiniEvent({
      event: 'share_timeline',
      source: share.share_intent,
      entity_id: card.code || '',
      page: 'profile',
      payload: {
        share_type: 'timeline',
        share_intent: share.share_intent,
        code: card.code || '',
        share_code: card.code || '',
        query,
        title,
        evidence: share.payload || {}
      }
    });
    return { title, query };
  },

  setShareIntent(event) {
    const intent = event.currentTarget.dataset.intent || 'peer_challenge';
    this.setData({ shareIntent: intent });
  },

  toggleAdvancedProfile() {
    this.setData({ showAdvancedProfile: !this.data.showAdvancedProfile });
  },

  chooseParentGoal(event) {
    const id = event.currentTarget.dataset.id || 'understand';
    const goal = PARENT_GOALS.find((item) => item.id === id) || PARENT_GOALS[3];
    if (storage.saveParentGoal) storage.saveParentGoal(goal);
    this.setData({ parentGoal: goal, showGoalOptions: false });
    wx.showToast({ title: `已切换：${goal.label}`, icon: 'none' });
    this.refresh();
  },

  toggleGoalOptions() {
    this.setData({ showGoalOptions: !this.data.showGoalOptions });
  },

  inviteParentView() {
    const summary = this.data.profileSafeSummary || {};
    const localUserId = storage.getLocalUserId ? storage.getLocalUserId() : 'user_local';
    const ledger = storage.recordInvite ? storage.recordInvite({ source: 'profile_parent_invite' }) : null;
    const inviteCode = `PARENT_${localUserId}`;
    const safePayload = buildSafeSharePayload({ code: inviteCode, payload: {} }, 'parent_invite', {
      share: inviteCode,
      share_code: inviteCode,
      share_intent: 'parent_invite',
      from: 'parent_invite',
      mode: 'parent_recap',
      tonight_action: summary.recentSummary || '今晚先听孩子说出自己的第一步',
      parent_question: summary.parentQuestion || '刚才你第一步先看了哪里？',
      tomorrow_check: '明天只回看一张最不稳的卡',
      relay_blocked_fields: ['original_question', 'full_answer', 'score', 'ranking', 'private_comment']
    });
    const invitePath = buildSchemaSharePath(safePayload);
    const card = {
      title: '今晚家里只看这一句',
      body: summary.recentSummary || '今晚还没有足够记录。先让孩子说出自己的第一步。',
      action: summary.parentQuestion || '你可以只问：刚才你第一步先看了哪里？',
      path: invitePath,
      badge: `本周 ${this.weeklyFirstStepCount()} 天确认第一步`,
      inviteCount: ledger && ledger.count ? ledger.count : (storage.loadInviteLedger ? storage.loadInviteLedger().count : 1)
    };
    if (storage.appendShareRun) {
      storage.appendShareRun({
        share_code: inviteCode,
        type: 'invite_parent_view',
        title: '邀请另一位家长查看',
        path: invitePath,
        share_intent: 'parent_invite',
        payload: Object.assign({}, safePayload, { card })
      });
    }
    this.setData({ parentInviteCard: card });
    wx.showToast({ title: '已生成家长分享卡', icon: 'none' });
  },

  weeklyFirstStepCount() {
    const profile = storage.loadUserFirstStepProfile ? storage.loadUserFirstStepProfile() : { events: [] };
    return (profile.events || []).slice(0, 7).filter((item) => item && item.childArticulatedStep).length;
  },

  generateWeeklySummaryImage() {
    const summary = this.data.profileSafeSummary || {};
    const count = this.weeklyFirstStepCount();
    const title = '原点私教本周小结';
    const body = summary.recentSummary || this.data.profileEmptyGuide || '今晚还没有足够记录，先让孩子说出自己的第一步。';
    const action = summary.parentQuestion || '你可以只问：刚才你第一步先看了哪里？';
    const badge = `本周 ${count} 天确认第一步`;
    const ctx = wx.createCanvasContext && wx.createCanvasContext('weeklySummaryCanvas', this);
    if (!ctx) {
      wx.showToast({ title: '当前环境暂不能生成图片', icon: 'none' });
      return;
    }
    ctx.setFillStyle('#f7fbf4');
    ctx.fillRect(0, 0, 640, 860);
    ctx.setFillStyle('#1f2a24');
    ctx.setFontSize(34);
    ctx.fillText(title, 48, 76);
    ctx.setFillStyle('#3f6b4f');
    ctx.setFontSize(24);
    ctx.fillText(badge, 48, 124);
    ctx.setFillStyle('#27362e');
    ctx.setFontSize(26);
    this.drawWrappedText(ctx, body, 48, 210, 540, 38, 4);
    ctx.setFillStyle('#1f2a24');
    ctx.setFontSize(28);
    ctx.fillText('今晚只问一句', 48, 440);
    ctx.setFillStyle('#3f5148');
    ctx.setFontSize(26);
    this.drawWrappedText(ctx, action, 48, 492, 540, 38, 4);
    ctx.setFillStyle('#3f6b4f');
    ctx.setFontSize(22);
    ctx.fillText('咕点不直接给答案，只记录孩子自己的第一步。', 48, 760);
    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'weeklySummaryCanvas',
        success: (res) => {
          this.setData({ weeklySummaryImagePath: res.tempFilePath || '' });
          if (wx.saveImageToPhotosAlbum && res.tempFilePath) {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => wx.showToast({ title: '小结图已保存', icon: 'none' }),
              fail: () => wx.showToast({ title: '已生成小结图，可手动保存', icon: 'none' })
            });
          } else {
            wx.showToast({ title: '已生成小结图', icon: 'none' });
          }
        },
        fail: () => wx.showToast({ title: '生成失败，请重试', icon: 'none' })
      }, this);
    });
  },

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const chars = String(text || '').split('');
    let line = '';
    let lineCount = 0;
    chars.forEach((char) => {
      const testLine = line + char;
      const width = ctx.measureText ? ctx.measureText(testLine).width : testLine.length * 24;
      if (width > maxWidth && line) {
        if (lineCount < maxLines) ctx.fillText(line, x, y + lineCount * lineHeight);
        line = char;
        lineCount += 1;
      } else {
        line = testLine;
      }
    });
    if (line && lineCount < maxLines) ctx.fillText(line, x, y + lineCount * lineHeight);
  },

  contactSupport() {
    wx.showModal({
      title: '反馈建议',
      editable: true,
      placeholderText: '哪里卡住了？写一句就行。',
      success: (res) => {
        if (res.confirm && storage.saveLocalFeedback) {
          storage.saveLocalFeedback({
            page: 'profile',
            text: res.content || '',
            source: 'friend_safe_shell'
          });
          wx.showToast({ title: '已记录反馈', icon: 'none' });
        }
      }
    });
  },

  copyParentOneQuestion() {
    if (wx.setClipboardData) {
      wx.setClipboardData({
        data: (this.data.profileSafeSummary && this.data.profileSafeSummary.parentQuestion) || '你第一步先看了哪里？',
        success: () => wx.showToast({ title: '已复制这一句', icon: 'none' })
      });
    }
  },

  copySupportWechat() {
    if (wx.setClipboardData) {
      wx.setClipboardData({
        data: 'yuandian-support',
        success: () => wx.showToast({ title: '已复制联系微信', icon: 'none' })
      });
    }
  },

  openProfilePanel(event) {
    const panel = event.currentTarget.dataset.panel || 'main';
    const titles = {
      assessment: '测评与方法建议',
      family: '给家里看的复盘',
      teacher: '家长只问一句',
      loop: '学习闭环记录',
      repair: '我的卡点修复',
      share: '可分享的复盘卡'
    };
    this.setData({
      profilePanel: panel,
      profilePanelTitle: titles[panel] || '我的'
    });
  },

  closeProfilePanel() {
    this.setData({
      profilePanel: 'main',
      profilePanelTitle: ''
    });
  },

  onAssessmentInput(event) {
    const scoreInput = event.detail.value;
    const analysis = learningAssessment.buildLearningAssessment(scoreInput);
    const reportInputPatch = analysis && analysis.reportInputPatch ? analysis.reportInputPatch : {};
    const nextReportInput = Object.assign({}, this.data.learningReportInput || {}, reportInputPatch, {
      sourceText: scoreInput,
      talentLearningMethodPlan: analysis.talentLearningMethodPlan
    });
    this.setData({
      'learningAssessment.scoreInput': scoreInput,
      'learningAssessment.talentLine': analysis.summaryLine,
      'learningAssessment.methodLine': analysis.methodHint,
      'learningAssessment.nextQuestion': analysis.nextQuestion,
      'learningAssessment.capability': analysis.capability,
      'learningAssessment.talentLearningMethodPlan': analysis.talentLearningMethodPlan,
      'learningAssessment.subject': analysis.subject,
      learningReportInput: nextReportInput
    });
    this.syncLearningReportFromInput(nextReportInput);
  },

  applyLearningReportRecognition(rawDraft = {}) {
    const currentInput = this.data.learningReportInput || {};
    const providerResult = rawDraft && (rawDraft.parsedScores || rawDraft.parsedRanks || rawDraft.assessmentSignals)
      ? {
        provider: rawDraft.mode || 'local_rules',
        recognizedText: rawDraft.recognizedText || currentInput.sourceText || '',
        parsedScores: rawDraft.parsedScores || {},
        parsedRanks: rawDraft.parsedRanks || {},
        assessmentSignals: rawDraft.assessmentSignals || {},
        confidence: rawDraft.confidence
      }
      : null;
    const draft = learningReportRecognition.normalizeRecognitionDraft({
      text: rawDraft.recognizedText || currentInput.sourceText || '',
      sourceType: rawDraft.sourceType || currentInput.sourceType || 'mixed',
      providerResult
    });
    const nextInput = learningReportRecognition.mergeRecognitionIntoReportInput(currentInput, draft);
    const reportState = this.syncLearningReportFromInput(nextInput);
    const reportWithDraft = Object.assign({}, reportState, { recognitionDraft: draft });
    if (storage.saveLearningReportState) storage.saveLearningReportState(reportWithDraft, { skipBuild: true });
    this.setData({
      learningReportInput: nextInput,
      learningReportState: reportWithDraft,
      learningReportSummary: buildLearningReportSummary(reportWithDraft),
      learningReportRecognitionSummary: buildRecognitionSummary(draft)
    });
    return reportWithDraft;
  },

  recognizeLearningReportInput() {
    const input = this.data.learningReportInput || {};
    const text = input.sourceText || '';
    if (!text.trim()) {
      wx.showToast({ title: '先粘贴成绩、错题或测评摘要', icon: 'none' });
      return Promise.resolve(null);
    }
    const payload = {
      text,
      sourceType: input.sourceType || 'mixed',
      fileMeta: input.fileMeta || {}
    };
    const fallback = () => {
      const draft = learningReportRecognition.buildRecognitionFallback(payload);
      const reportState = this.applyLearningReportRecognition(draft);
      wx.showToast({ title: '已整理草稿，请确认', icon: 'none' });
      return reportState;
    };
    if (!api.recognizeLearningReport) return Promise.resolve(fallback());
    return api.recognizeLearningReport(payload).then((result) => {
      const reportState = this.applyLearningReportRecognition(result || {});
      wx.showToast({ title: '已整理草稿，请确认', icon: 'none' });
      return reportState;
    }).catch(() => fallback());
  },

  learningReportAnswersAsList(answersMap) {
    const answers = answersMap || {};
    return Object.keys(answers).filter((id) => answers[id]).map((id) => ({
      id,
      optionId: answers[id],
      confidence: 0.82,
      source: 'quick_assessment'
    }));
  },

  syncLearningReportFromInput(patch = {}) {
    const input = Object.assign({}, this.data.learningReportInput, patch || {});
    const existingSources = Array.isArray(input.reportSources) ? input.reportSources : [];
    const selectedAnswers = this.learningReportAnswersAsList(this.data.learningReportAnswers);
    const patchAnswers = Array.isArray(input.assessmentAnswers) ? input.assessmentAnswers : [];
    const payload = Object.assign({}, input, {
      reportSources: existingSources.length ? existingSources : input.sourceText ? [{
        type: 'manual_text',
        label: '成绩单/测评资料',
        text: input.sourceText,
        confidence: 0.74,
        status: '待家长确认'
      }] : [],
      parsedScores: input.parsedScores || {},
      parsedRanks: input.parsedRanks || {},
      recognitionDraft: input.recognitionDraft || null,
      assessmentAnswers: selectedAnswers.length ? selectedAnswers : patchAnswers
    });
    const reportState = storage.buildLearningReportFromInput
      ? storage.buildLearningReportFromInput(payload)
      : learningReport.buildLearningReportDraft(payload);
    if (payload.recognitionDraft) reportState.recognitionDraft = payload.recognitionDraft;
    if (storage.saveLearningReportState) storage.saveLearningReportState(reportState, { skipBuild: true });
    const selectedMap = this.data.learningReportAnswers || {};
    this.setData({
      learningReportInput: input,
      learningReportState: reportState,
      learningReportSummary: buildLearningReportSummary(reportState),
      learningReportRecognitionSummary: buildRecognitionSummary(payload.recognitionDraft || (reportState && reportState.recognitionDraft) || { mode: 'unavailable' }),
      learningReportQuestionnaire: (learningReport.buildQuickAssessmentQuestions ? learningReport.buildQuickAssessmentQuestions() : []).map((item) => Object.assign({}, item, {
        selectedOptionId: selectedMap[item.id] || ''
      }))
    });
    return reportState;
  },

  onLearningReportFieldInput(event) {
    const section = event.currentTarget.dataset.section || '';
    const field = event.currentTarget.dataset.field || '';
    const value = event.detail.value;
    if (!section || !field) return;
    const nextSection = Object.assign({}, this.data.learningReportInput[section] || {}, {
      [field]: value
    });
    this.setData({
      [`learningReportInput.${section}`]: nextSection
    });
    this.syncLearningReportFromInput({ [section]: nextSection });
  },

  selectLearningReportMode(event) {
    const mode = event.currentTarget.dataset.mode || 'fast';
    this.setData({ 'learningReportInput.mode': mode });
    this.syncLearningReportFromInput({ mode });
  },

  toggleLearningQuestionnaire() {
    this.setData({ showLearningQuestionnaire: !this.data.showLearningQuestionnaire });
  },

  answerLearningQuestion(event) {
    const id = event.currentTarget.dataset.id || '';
    const optionId = event.currentTarget.dataset.option || '';
    if (!id || !optionId) return;
    const learningReportAnswers = Object.assign({}, this.data.learningReportAnswers || {}, {
      [id]: optionId
    });
    this.setData({ learningReportAnswers });
    const selectedAnswers = learningReportAnswers;
    const questionnaire = (learningReport.buildQuickAssessmentQuestions ? learningReport.buildQuickAssessmentQuestions() : []).map((item) => Object.assign({}, item, {
      selectedOptionId: selectedAnswers[item.id] || ''
    }));
    this.setData({ learningReportQuestionnaire: questionnaire });
    this.syncLearningReportFromInput({ assessmentAnswers: this.learningReportAnswersAsList(learningReportAnswers) });
  },

  generateLearningReport() {
    const reportState = this.syncLearningReportFromInput();
    const title = reportState.reportStatus && reportState.reportStatus.requiresConfirmation ? '已生成，待确认' : '已生成学习画像';
    wx.showToast({ title, icon: 'none' });
  },

  goLearningReportCta() {
    const summary = this.data.learningReportSummary || {};
    const path = summary.nextActionRoute || summary.ctaPath || '/pages/tutor/tutor?from=learning_report';
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'profile',
        dimensionId: summary.capabilityLedger && summary.capabilityLedger.nextCapability
          ? summary.capabilityLedger.nextCapability.id
          : 'report_to_solution',
        label: summary.capabilityNextLine || summary.ctaLabel || '',
        route: summary.capabilityRoute || path,
        readiness: 'learning_report_cta'
      });
    }
    navigation.navigateLearningRoute(path);
  },

  runFamilyDecisionHomepageAction() {
    const summary = this.data.learningReportSummary || {};
    const route = summary.familyDecisionHomepageRoute || summary.nextActionRoute || '/pages/tutor/tutor?from=family_decision_homepage';
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction({
        source: 'family_decision_homepage',
        sourceLabel: '家长决策首页',
        actionId: 'family_decision_homepage_cta',
        actionLabel: summary.familyDecisionHomepageCtaLabel || '去看家长决策书',
        route,
        reasonLine: summary.familyDecisionHomepageHeadline || '',
        evidenceLine: summary.familyDecisionHomepageSourceLine || ''
      });
    }
    navigation.navigateLearningRoute(route);
  },

  runBorrowWorkbenchAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const route = dataset.route || '/pages/upload/upload?from=openmaic_k12_workbench';
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction({
        source: 'openmaic_k12_borrow_workbench',
        sourceLabel: 'OpenMAIC/K12 借力工作台',
        actionId: dataset.id || 'borrow_workbench',
        actionLabel: dataset.label || '继续补证据',
        route,
        reasonLine: '公开资料只做结构借鉴；AI 负责表达，本地代码负责门禁和回流。'
      });
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'profile',
        dimensionId: dataset.id || 'openmaic_k12_borrow_workbench',
        label: dataset.label || 'OpenMAIC/K12 借力工作台',
        route,
        readiness: 'borrow_workbench_visible'
      });
    }
    navigation.navigateLearningRoute(route);
  },

  runUploadedMaterialDossierAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const route = dataset.route || '/pages/upload/upload?from=uploaded_material_dossier';
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction({
        source: 'uploaded_material_dossier',
        sourceLabel: '刚上传资料卷宗',
        actionId: dataset.id || 'uploaded_material_dossier',
        actionLabel: dataset.label || '继续处理资料',
        route,
        reasonLine: dataset.reason || '',
        evidenceLine: this.data.learningReportSummary && this.data.learningReportSummary.uploadedMaterialDecisionDossierHandoffLine || ''
      });
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'profile',
        dimensionId: dataset.id || 'uploaded_material_dossier',
        label: dataset.label || '继续处理资料',
        route,
        readiness: 'uploaded_material_dossier'
      });
    }
    navigation.navigateLearningRoute(route);
  },

  startAssessmentFromProfile() {
    this.setData({
      showAdvancedProfile: true,
      profilePanel: 'assessment',
      profilePanelTitle: '测评与方法建议'
    });
  },

  buildParentTonightItems(state) {
    const plan = (state && state.homework_plan) || {};
    const must = (plan.must_do || []).slice(0, 3);
    const weak = ((state && state.weak_points) || [])[0] || null;
    if (must.length) {
      const first = must[0];
      return [
        {
          id: 'weak_focus',
          title: weak ? weak.name : first.text || '当前关键卡点',
          label: '高优先级',
          level: 'high'
        },
        {
          id: first.id || 'must_first',
          title: first.text || first.title || '先完成关键练习',
          label: '今晚必做',
          level: 'mid'
        },
        {
          id: 'proof',
          title: '结束前说出卡点和下一步',
          label: '收尾',
          level: 'low'
        }
      ];
    }
    return [
      { id: 'input', title: '还没有今晚任务', label: '待开始', level: 'high' },
      { id: 'pack', title: '先录入作业、错题或卡住点', label: '下一步', level: 'mid' },
      { id: 'review', title: '完成一次任务后再看卡点记录', label: '待积累', level: 'low' }
    ];
  },

  buildDataFlywheel(reviewSummary, moduleSummary, tutorSummary, thinkingSummary, calibrationProfile, factorySummary) {
    const review = reviewSummary || {};
    const modules = moduleSummary || {};
    const tutor = tutorSummary || {};
    const thinking = thinkingSummary || {};
    const calibration = calibrationProfile || {};
    const factory = factorySummary || {};
    const assets = [
      { id: 'weakness', label: '卡点图谱', value: calibration.weakPoint || '形成中', source: '复盘 + 作业' },
      { id: 'decision', label: '作业决策', value: safeNumber(calibration.homework && calibration.homework.accuracyRate, 0) + '%', source: '反馈校准' },
      { id: 'tutor', label: '思路记录', value: safeNumber(thinking.total, 0), source: '作业点拨' },
      { id: 'memory', label: '记忆卡', value: safeNumber(review.total, 0), source: '复习引擎' },
      { id: 'module', label: '关卡适配', value: safeNumber(modules.useful, 0), source: '学习方法' },
      { id: 'factory', label: '关卡生成', value: safeNumber(factory.generated, 0), source: '材料 -> 关卡' }
    ];
    const loopScore = Math.min(100, 58
      + Math.min(12, safeNumber(review.total, 0))
      + Math.min(10, safeNumber(thinking.total, 0) * 2)
      + Math.min(10, safeNumber(tutor.completed, 0) * 3)
      + Math.min(10, safeNumber(modules.feedback, 0) * 2)
      + Math.min(8, safeNumber(factory.generated, 0) * 2));
    return {
      title: '数据飞轮',
      label: '每一次学习动作都应该让下一次决策更准：卡点、作业优先级、点拨提示和复习安排。',
      loopScore,
      loopLabel: loopScore >= 86 ? '稳定' : loopScore >= 68 ? '形成中' : '待积累',
      assets,
      loop: [
        '收集卡点和作业信号。',
        '选择必须做，过滤低价值负担。',
        '作业点拨要一句自己的话，不直接讲最终结果。',
        '把错误转成卡片、测验和修复。',
        '反馈校准下一次推荐。'
      ]
    };
  },

  buildFlywheelCoach(reviewSummary, moduleSummary, tutorSummary, thinkingSummary, calibrationProfile, factorySummary, pilotSummary) {
    const review = reviewSummary || {};
    const modules = moduleSummary || {};
    const tutor = tutorSummary || {};
    const thinking = thinkingSummary || {};
    const calibration = calibrationProfile || {};
    const factory = factorySummary || {};
    const pilot = pilotSummary || {};
    const actions = [];
    if (!pilot.total) {
      actions.push({ id: 'pilot', priority: 'P0', title: '启动首批真实家庭体验', body: '记录节省时间、学习信心和复习回访。' });
    } else if (Number(pilot.returnRate || 0) < 60) {
      actions.push({ id: 'return', priority: 'P0', title: '修复复习回访', body: '把每日复习压到5分钟，并给自己一张可见进展卡。' });
    }
    if (!factory.generated || Number(factory.quality || 0) < 85) {
      actions.push({ id: 'factory', priority: 'P1', title: '提高内容工厂质量', body: '导入前补齐精确卡点、对比例题和一道迁移检查。' });
    }
    if (Number(review.due || 0) > 12) {
      actions.push({ id: 'workload', priority: 'P1', title: '降低复习负载', body: '限制到期卡数量，先修顽固卡，避免低价值回忆把孩子淹没。' });
    }
    if (Number(tutor.blocked || 0) > Number(tutor.completed || 0)) {
      actions.push({ id: 'safety', priority: 'P1', title: '收紧抄结果拦截', body: '任何解释前都先问第一想法和卡点。' });
    }
    if (Number(modules.feedback || 0) < 3) {
      actions.push({ id: 'modules', priority: 'P2', title: '收集关卡适配反馈', body: '每次关卡结束后标记有用/无用，让推荐逐渐收敛。' });
    }
    if (Number(thinking.total || 0) < 3) {
      actions.push({ id: 'thinking', priority: 'P2', title: '积累更多思路记录', body: '每次点拨都以一句自己能复述的话结束。' });
    }
    if (!actions.length) {
      actions.push({ id: 'scale', priority: 'P0', title: '沉淀有效闭环', body: `当前重点「${calibration.weakPoint || '形成中'}」已经比较清楚，先继续观察真实家庭是否愿意持续使用。` });
    }
    return {
      title: '飞轮建议',
      label: '根据复习、作业点拨、内容工厂、真实体验和反馈校准信号，判断下一步。',
      actions: actions.slice(0, 4)
    };
  },

  buildCapabilityPosition(reviewSummary, thinkingSummary) {
    const review = reviewSummary || {};
    const thinking = thinkingSummary || {};
    return {
      title: '能力闭环图',
      label: '按家庭可用链路自检。账号连续性、模型服务和长期数据校准属于生产配置项。',
      rows: [
        { id: 'content_loop', name: '内容回访', score: review.contentPipeline ? 98 : 94, strength: '材料 -> 卡片 -> 小测 -> 连续记录', gap: '真实材料处理和稳定复盘规模' },
        { id: 'memory_loop', name: '长期记忆', score: review.retentionLab ? 96 : 92, strength: '间隔复习、负载控制和卡点修复', gap: '真实调度参数校准' },
        { id: 'tutor_loop', name: '原小点学伴', score: thinking.total ? 99 : 96, strength: '追问引导和思路记录', gap: '模型级误区复盘' },
        { id: 'china_student', name: '中国学生场景', score: 100, strength: '今晚安排 -> 作业三分类 -> 我的进展', gap: '需要真实体验记录' }
      ]
    };
  },

  onProfileInput(event) {
    const field = event.currentTarget.dataset.field;
    const profile = Object.assign({}, this.data.profile, {
      [field]: event.detail.value
    });
    storage.saveProfile(profile);
    this.setData({ profile });
  },

  onLeadInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      lead: Object.assign({}, this.data.lead, {
        [field]: event.detail.value
      })
    });
  },

  onPilotInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    this.setData({
      pilotForm: Object.assign({}, this.data.pilotForm, {
        [field]: field === 'minutes_saved' || field === 'confidence' || field === 'answer_blocks'
          ? Number(value || 0)
          : value
      })
    });
  },

  onPilotSwitch(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      pilotForm: Object.assign({}, this.data.pilotForm, {
        [field]: !!event.detail.value
      })
    });
  },

  onConsent(event) {
    const consent = !!event.detail.value;
    storage.set(storage.KEYS.consent, consent);
    this.setData({ consent });
  },

  submitPilotRun() {
    if (!storage.appendPilotRun) return;
    storage.appendPilotRun(Object.assign({}, this.data.pilotForm));
    wx.showToast({ title: '体验记录已保存', icon: 'success' });
    this.setData({
      pilotForm: {
        family: '',
        minutes_saved: 15,
        confidence: 4,
        answer_blocks: 0,
        review_returned: true,
        note: ''
      }
    });
    this.refresh();
  },

  initSession() {
    if (this.data.syncing) return;
    this.setData({ syncing: true, loginText: '正在建立会话' });
    api.initSession(this.data.profile).then((session) => {
      storage.saveClientIdentity({
        user_id: session.openid_hash || session.session_id || '',
        auth_mode: session.mode || 'local'
      });
      wx.showToast({ title: session.mode === 'wechat' ? '微信会话已建立' : '本地会话已建立', icon: 'success' });
      this.refresh();
    }).catch((error) => {
      wx.showToast({ title: error.message || '会话失败', icon: 'none' });
    }).finally(() => {
      this.setData({ syncing: false, loginText: '微信登录 / 本地会话' });
    });
  },

  syncNow() {
    if (this.data.syncing) return;
    this.setData({ syncing: true });
    api.flushLocalSyncQueue().then((result) => {
      const cloudSynced = result.ok && result.mode && result.mode !== 'local_receipt' && result.mode !== 'empty';
      const title = cloudSynced
        ? `已同步 ${result.pushed || 0} 条`
        : result.ok
          ? '已暂存在本机'
          : '同步暂存本地';
      wx.showToast({ title, icon: cloudSynced ? 'success' : 'none' });
      this.refresh();
    }).finally(() => {
      this.setData({ syncing: false });
    });
  },

  runParentReportAction(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'lead') {
      this.setData({ showLeadCard: true });
      api.submitEvent({
        event: 'lead_intent_opened',
        source: 'profile_unlock_card',
        page: 'profile',
        payload: {
          evidence_done: this.data.commercialUnlockCard ? this.data.commercialUnlockCard.done : 0,
          evidence_total: this.data.commercialUnlockCard ? this.data.commercialUnlockCard.total : 0
        }
      }).catch(() => {});
      return;
    }
    const routeTargets = {
      tools: '/pages/tools/tools',
      review: '/pages/review/review',
      upload: '/pages/upload/upload',
      radar: '/pages/radar/radar',
      arcade: '/pages/arcade/arcade',
      tutor: '/pages/tutor/tutor'
    };
    if (routeTargets[action]) {
      navigation.navigateLearningRoute(routeTargets[action]);
    }
  },

  recordRealTrialSample(event) {
    const dataset = event.currentTarget.dataset || {};
    const todayFocus = this.data.todayFocus || {};
    const summary = this.data.learningReportSummary || {};
    const subjectSkillDepth = this.data.subjectSkillDepth || {};
    const latest = (summary.realTrialRecoveryLatest || [])[0] || {};
    const sample = {
      id: `profile_trial_${Date.now()}`,
      subject: dataset.subject || subjectSkillDepth.subject || todayFocus.subject || latest.subject || '家庭作业',
      taskType: dataset.taskType || subjectSkillDepth.taskType || todayFocus.taskType || latest.taskType || 'family_homework_trial',
      childTask: todayFocus.sourceText || todayFocus.thought || todayFocus.title || summary.diagnosisLine || '今晚真实作业试用',
      firstStep: todayFocus.childArticulatedStep || todayFocus.systemSuggestedStep || summary.ctaLabel || '先让孩子说出第一步',
      wrongCause: todayFocus.wrongCause || summary.diagnosisLine || '待确认错因',
      boardUse: summary.visualBoardLine || '小黑板只画第一步，不写最终答案',
      parentCheck: summary.planLine || '家长只问：你第一步先看哪里？',
      revisitPlan: summary.reportTodayActionLine || '明天换一道同类小题回看',
      neededHelp: dataset.mode === 'needs_help',
      droppedOff: dataset.mode === 'dropoff',
      confusedStep: dataset.mode === 'needs_help' ? '孩子需要额外提示才说出第一步' : '',
      privacyConcern: false,
      sourceId: 'profile_real_trial_button'
    };
    if (storage.appendRealTrialSample) {
      storage.appendRealTrialSample(sample);
    }
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction({
        source: 'real_trial_recovery',
        sourceLabel: '真实试用回收',
        actionLabel: '把这次卡点转成压力样本',
        reasonLine: '真实家庭试用比继续堆资料更能发现厚而不准的问题。',
        evidenceLine: `${sample.subject}｜${sample.taskType}｜${sample.firstStep}`,
        route: '/pages/profile/profile',
        surface: 'profile'
      });
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'profile',
        dimensionId: 'real_trial_recovery_loop',
        label: '真实试用回收',
        route: '/pages/profile/profile',
        readiness: 'real_trial_recovery'
      });
    }
    wx.showToast({ title: '已记录真实试用', icon: 'success' });
    this.refresh();
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  openEntryDetail(event) {
    const scene = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.scene
      : 'parent';
    wx.navigateTo({ url: `/pages/entry-detail/entry-detail?scene=${scene || 'parent'}` });
  },

  goTools() {
    navigation.navigateLearningRoute('/pages/tools/tools');
  },

  goFocus() {
    navigation.navigateLearningRoute('/pages/focus/focus');
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  submitLead() {
    if (this.data.sending) return;
    if (!this.data.lead.phone && !this.data.lead.name) {
      wx.showToast({ title: '请先留称呼或联系方式', icon: 'none' });
      return;
    }
    this.setData({ sending: true });
    const unlock = this.data.commercialUnlockCard || {};
    const share = this.data.dailyShareCard || {};
    api.submitLead({
      name: this.data.lead.name,
      phone: this.data.lead.phone,
      kid: this.data.lead.kid || `${this.data.profile.grade} ${this.data.profile.subject}`,
      page: 'miniprogram/profile',
      utm_source: 'profile_unlock',
      evidence_done: String(unlock.done || 0),
      evidence_total: String(unlock.total || 0),
      identity_tag: share.identityTag || '',
      invite_code: share.inviteCode || share.code || '',
      share_code: share.inviteCode || share.code || '',
      tier_label: '小程序 MVP 咨询'
    }).then((result) => {
      sendMiniEvent({
        event: 'lead_submitted',
        source: 'profile_unlock',
        entity_id: share.inviteCode || share.code || '',
        page: 'profile',
        payload: {
          share_code: share.inviteCode || share.code || '',
          identity_tag: share.identityTag || '',
          evidence_done: String(unlock.done || 0),
          evidence_total: String(unlock.total || 0),
          tier_label: 'miniapp_mvp_consult'
        }
      });
      const serviceReady = result && result.service_ready;
      wx.showToast({ title: serviceReady ? '已提交' : '已在本机记录', icon: serviceReady ? 'success' : 'none' });
    }).catch((error) => {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    }).finally(() => {
      this.setData({ sending: false });
    });
  },

  openLegal(event) {
    const type = event.currentTarget.dataset.type || 'privacy';
    wx.navigateTo({ url: `/pages/legal/legal?type=${type}` });
  },

  clearLocalData() {
    wx.showModal({
      title: '清除本地学习数据',
      content: '将清除本机的今晚安排、作业分类、会话、复习卡和临时选择；不影响你已经主动提交的咨询信息。',
      confirmText: '清除',
      confirmColor: '#B85C2E',
      success: (res) => {
        if (!res.confirm) return;
        storage.clearLearningData();
        this.refresh();
        wx.showToast({ title: '已清除', icon: 'success' });
      }
    });
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

  goCapabilityLedgerRoute(event) {
    const dataset = event.currentTarget.dataset || {};
    const ledger = this.data.capabilityEvidenceLedger || {};
    const next = ledger.nextCapability || {};
    const route = dataset.route || next.route || '/pages/tutor/tutor';
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'profile',
        dimensionId: next.id || 'capability_ledger',
        label: next.label || '能力证据账本',
        route,
        readiness: 'capability_evidence_ledger'
      });
    }
    navigation.navigateLearningRoute(route);
  },

  runUnifiedNextAction() {
    const next = this.data.unifiedNextAction || {};
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction(Object.assign({}, next, { surface: 'profile' }));
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'profile',
        dimensionId: next.source || 'unified_next_action',
        label: next.actionLabel || '',
        route: next.route || '',
        readiness: 'unified_next_action'
      });
    }
    navigation.navigateLearningRoute(next.route || '/pages/tutor/tutor');
  },

  runCapabilityMaturityAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const queue = this.data.capabilityMaturityQueue || {};
    const items = Array.isArray(queue.items) ? queue.items : [];
    const item = items.find((entry) => entry.id === dataset.id) || queue.next || {};
    const route = dataset.route || item.route || '/pages/tutor/tutor';
    const action = Object.assign({
      source: 'capability_maturity_queue',
      sourceLabel: '全局能力厚度队列',
      actionLabel: item.nextAction || '先补这一条能力证据',
      reasonLine: item.competitorLine || '',
      evidenceLine: item.evidenceLine || '',
      route
    }, item.actionPayload || {});
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction(Object.assign({}, action, { surface: 'profile' }));
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: item.surface || 'profile',
        dimensionId: item.id || 'capability_maturity_queue',
        label: item.label || action.actionLabel,
        route,
        readiness: 'capability_maturity_queue'
      });
    }
    navigation.navigateLearningRoute(route);
  },

  runFinalTargetAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const snapshot = this.data.profileReadinessSnapshot || {};
    const rows = Array.isArray(snapshot.finalTargetRows) ? snapshot.finalTargetRows : [];
    const item = rows.find((entry) => entry.id === dataset.id) || {};
    const route = dataset.route || item.route || '/pages/profile/profile';
    const action = {
      source: 'final_target_gap_meter',
      sourceLabel: '竞品级商用目标差距表',
      actionId: item.id || dataset.id || 'final_target_next',
      actionLabel: item.label || '继续推进最终目标',
      reasonLine: `${item.status || '待推进'} · ${Number(item.progress || 0)}%`,
      evidenceLine: item.nextAction || snapshot.finalTargetNextAction || '',
      route
    };
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction(Object.assign({}, action, { surface: 'profile' }));
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'profile',
        dimensionId: action.actionId,
        label: action.actionLabel,
        route,
        readiness: 'final_target_gap_meter'
      });
    }
    navigation.navigateLearningRoute(route);
  },

  runFamilyDecisionBridgeAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const route = dataset.route || '/pages/tutor/tutor?from=family_decision_bridge';
    const action = {
      source: 'family_decision_bridge',
      sourceLabel: '家庭决策行动桥',
      actionId: dataset.id || 'tutor',
      actionLabel: dataset.label || '今晚点拨',
      route,
      reasonLine: dataset.reason || '',
      evidenceLine: dataset.evidence || '',
      shareIntent: dataset.shareIntent || ''
    };
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction(Object.assign({}, action, { surface: 'profile' }));
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'profile',
        dimensionId: action.actionId,
        label: action.actionLabel,
        route,
        readiness: 'family_decision_bridge',
        capabilityId: action.actionId === 'practice' ? 'game' : action.actionId === 'share' ? 'share' : 'socratic'
      });
    }
    sendMiniEvent({
      event: 'family_decision_bridge_action',
      source: 'profile_learning_report',
      entity_id: action.actionId,
      page: 'profile',
      payload: {
        route,
        action_label: action.actionLabel,
        reason: action.reasonLine,
        evidence: action.evidenceLine,
        share_intent: action.shareIntent
      }
    });
    navigation.navigateLearningRoute(route);
  },

});
