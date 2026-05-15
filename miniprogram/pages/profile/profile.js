const api = require('../../utils/api');
const storage = require('../../utils/storage');
const reviewCards = require('../../utils/review-cards');
const gameLogic = require('../../utils/game-logic');
const profileViewModels = require('../../view-models/profile-view-model');
const focusCabin = require('../../utils/focus-cabin');
const learningAssessment = require('../../utils/learning-assessment');
const learningReport = require('../../utils/learning-report');
const learningReportRecognition = require('../../utils/learning-report-recognition');

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
      { id: 'prompt', label: '咕点追问', text: tutorText }
    ].slice(0, 2),
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

function buildDailyShareCard(profile, reviewSummary, gameProfileCard, wrongCauseSummary, todayFocus) {
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
  const path = `/pages/home/home?share=${code}&from=daily_card&challenge=arcade&mode=same_identity&identity=${encodeURIComponent(identityTag)}`;
  const parentPath = `/pages/home/home?share=${code}&from=parent_card&mode=parent_recap&identity=${encodeURIComponent(identityTag)}`;
  const peerPath = `/pages/home/home?share=${code}&from=peer_challenge&challenge=arcade&mode=same_identity&identity=${encodeURIComponent(identityTag)}`;
  const parentShareTitle = todayFocus && todayFocus.title
    ? `今晚先看这一处：${storage.formatIssueType(todayFocus.issueType || '卡点')} · ${todayFocus.title}`
    : '给家里看的今日学习复盘';
  const peerShareTitle = `今天轻回访 5 分钟：${identityTag}`;
  const shareCount = storage.loadShareRuns ? storage.loadShareRuns().length : 0;
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
      invite_code: code,
      share_code: code,
      share_variant: shareVariant,
      proof_type: shareVariant,
      next_challenge: 'arcade',
      parent_card: true,
      peer_challenge: true,
      mode: 'same_identity',
      challenge: 'arcade'
    }
  };
}

function resolveShareIntent(card, intent) {
  const current = intent || 'peer_challenge';
  const code = card.code || 'LOCAL';
  if (current === 'parent_card') {
    return {
      share_intent: 'parent_card',
      title: card.parentShareTitle || card.title || '给家里看的今日学习复盘',
      path: card.parentPath || `/pages/home/home?share=${code}&from=parent_card&mode=parent_recap&identity=${encodeURIComponent(card.identityTag || '')}`,
      payload: Object.assign({}, card.payload || {}, {
        share_intent: 'parent_card',
        from: 'parent_card',
        mode: 'parent_recap'
      })
    };
  }
  return {
    share_intent: 'peer_challenge',
    title: card.peerShareTitle || card.title || '来和我一起回访今天的一小步',
    path: card.peerPath || card.path || `/pages/home/home?share=${code}&from=peer_challenge&challenge=arcade&mode=same_identity&identity=${encodeURIComponent(card.identityTag || '')}`,
    payload: Object.assign({}, card.payload || {}, {
      share_intent: 'peer_challenge',
      from: 'peer_challenge',
      mode: 'same_identity',
      challenge: 'arcade'
    })
  };
}

function buildProfileSafeSummary(todayFocus, focusHistory = [], profileEmptyGuide = '') {
  const todaySession = storage.getTodaySession ? storage.getTodaySession() : null;
  const realSummary = storage.buildRecentLearningSummary ? storage.buildRecentLearningSummary() : null;
  const latestSession = focusHistory[0] || null;
  const childStep = String(
    (todaySession && todaySession.childArticulatedStep)
    || (todayFocus && (todayFocus.childArticulatedStep || todayFocus.childStepSentence || todayFocus.title))
    || (latestSession && (latestSession.linkedChildArticulatedStep || latestSession.linkedSystemSuggestedStep || latestSession.focusEvidenceText))
    || ''
  ).trim();
  const stuckPoint = String(
    (todaySession && todaySession.stuckPointText)
    || (todayFocus && (todayFocus.stuckPointText || todayFocus.sourceText || todayFocus.title))
    || (latestSession && latestSession.linkedStuckPointText)
    || ''
  ).trim();
  const days = focusHistory
    .slice(0, 7)
    .map((item) => String(item.completedAt || item.interruptedAt || item.startedAt || '').slice(0, 10))
    .filter(Boolean);
  const uniqueDays = Array.from(new Set(days)).length;
  return {
    isEmpty: !(childStep || stuckPoint || uniqueDays),
    stuckLine: stuckPoint || childStep || '今晚还没有记录。先让孩子说出自己的第一步。',
    parentQuestion: storage.parentQuestionFromFirstStep ? storage.parentQuestionFromFirstStep(childStep) : '你第一步先做了什么？',
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

function buildLearningReportSummary(reportState = {}) {
  const draft = reportState.reportDraft || {};
  const overview = draft.overview || {};
  const plan = draft.recommendationPlan || {};
  const matrix = Array.isArray(draft.diagnosisMatrix) ? draft.diagnosisMatrix : [];
  const tendencies = Array.isArray(draft.capabilityTendencies) ? draft.capabilityTendencies : [];
  const mainDiagnosis = matrix.find((item) => item.status === '需要支持') || matrix[0] || null;
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
    missingLine: (draft.missingItems || []).slice(0, 3).join(' · '),
    tendencyLines: tendencies.slice(0, 3).map((item) => `${item.label}：${item.description}`),
    questionnaire: learningReport.buildQuickAssessmentQuestions ? learningReport.buildQuickAssessmentQuestions() : []
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
    parentActionGuide: storage.buildParentActionGuide ? storage.buildParentActionGuide() : null,
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
      this.getTabBar().setData({ selected: 4 });
    }
    this.refresh();
  },

  refresh() {
    if (storage.recordProfileVisit) storage.recordProfileVisit({ source: 'profile_refresh' });
    const reviewSummary = reviewCards.reviewSummary();
    const profile = storage.loadProfile();
    const learningReportState = storage.loadLearningReportState ? storage.loadLearningReportState() : null;
    const learningReportSummary = buildLearningReportSummary(learningReportState || {});
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
    const dailyShareCard = buildDailyShareCard(profile, reviewSummary, gameProfileCard, wrongCauseSummary, todayFocus);
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
        }, dailyShareCard.payload || {})
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
      commercialUnlockCard: buildCommercialUnlockCard(reviewSummary, tutorSummary, thinkingSummary, wrongCauseSummary),
      parentActionGuide,
      profileSafeSummary,
      experienceChecklist: parentActionGuide ? parentActionGuide.experienceChecklist : (storage.buildExperienceChecklist ? storage.buildExperienceChecklist() : []),
      experienceDashboard: storage.calculateValidationDashboard ? storage.calculateValidationDashboard() : null,
      developerFunnel: localAnalytics,
      isBetaTester: storage.isBetaTester ? storage.isBetaTester() : false,
      pilotSummary: storage.pilotRunSummary ? storage.pilotRunSummary() : null
    });
  },

  onLoad() {
    if (wx.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
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
    const invitePath = `/pages/home/home?ref=${localUserId}`;
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
        type: 'invite_parent_view',
        title: '邀请另一位家长查看',
        path: invitePath,
        payload: card
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
    this.setData({
      'learningAssessment.scoreInput': scoreInput,
      'learningAssessment.talentLine': analysis.summaryLine,
      'learningAssessment.methodLine': analysis.methodHint,
      'learningAssessment.nextQuestion': analysis.nextQuestion,
      'learningAssessment.capability': analysis.capability,
      'learningAssessment.subject': analysis.subject,
      'learningReportInput.sourceText': scoreInput
    });
    this.syncLearningReportFromInput({ sourceText: scoreInput });
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
      assessmentAnswers: this.learningReportAnswersAsList(this.data.learningReportAnswers)
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
    const path = this.data.learningReportSummary && this.data.learningReportSummary.ctaPath
      ? this.data.learningReportSummary.ctaPath
      : '/pages/tutor/tutor?from=learning_report';
    const cleanPath = path.split('?')[0];
    if (['/pages/home/home', '/pages/review/review', '/pages/focus/focus', '/pages/tools/tools', '/pages/profile/profile'].indexOf(cleanPath) >= 0) {
      wx.switchTab({ url: cleanPath });
      return;
    }
    wx.navigateTo({ url: path });
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
    const tabTargets = {
      tools: '/pages/tools/tools',
      review: '/pages/review/review'
    };
    const pageTargets = {
      upload: '/pages/upload/upload',
      radar: '/pages/radar/radar',
      arcade: '/pages/arcade/arcade',
      tutor: '/pages/tutor/tutor'
    };
    if (tabTargets[action]) {
      wx.switchTab({ url: tabTargets[action] });
      return;
    }
    if (pageTargets[action]) {
      wx.navigateTo({ url: pageTargets[action] });
    }
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
  }
});
