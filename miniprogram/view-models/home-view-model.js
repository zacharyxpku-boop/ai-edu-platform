const storage = require('../utils/storage');

const UNSAFE_KEY_RE = /^[a-z]+(?:_[a-z0-9]+)+$|[a-z]+[A-Z][a-zA-Z]+/;

const COMPANION_HOME_COPY = {
  gudian: '咕点：我懂你卡住了，我陪你先迈出第一步。'
};

function safeText(value, fallback = '今晚路线') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || UNSAFE_KEY_RE.test(text)) return fallback;
  return text.slice(0, 90);
}

function companionPreference(input) {
  if (storage.buildCompanionPreference) return storage.buildCompanionPreference(input || {});
  return Object.assign({ selectedCompanion: 'gudian', selectedLabel: '咕点' }, input || {});
}

function companionStrip(input) {
  const preference = companionPreference(input);
  return COMPANION_HOME_COPY[preference.selectedCompanion] || COMPANION_HOME_COPY.gudian;
}

function buildNextStep(input) {
  if (input && input.miniLessonResume) {
    return {
      text: `下一步：接上 ${safeText(input.miniLessonResume.topicLabel || input.miniLessonResume.conceptGap, '3 分钟小讲堂')}。`,
      cta: '继续小讲堂',
      action: 'miniLesson'
    };
  }
  if (input && input.todayFocus) {
    return {
      text: '下一步：去修今晚最卡的一步。',
      cta: '去修卡点',
      action: 'review'
    };
  }
  if (input && input.tonightPlan) {
    return {
      text: '下一步：先说一句你卡在哪里。',
      cta: '我来说第一步',
      action: 'first'
    };
  }
  return null;
}

function buildMiniLessonResume(input = {}) {
  const source = input.miniLessonResume || null;
  if (!source) return null;
  return {
    id: source.id || 'mini_lesson_resume',
    title: '继续 3 分钟小讲堂',
    topicLabel: safeText(source.topicLabel || source.title || source.conceptGap, '当前概念缺口'),
    blackboardLine: safeText(source.blackboardLine || source.firstStep || source.prompt, '先说出第一步'),
    parentLine: safeText(source.parentLine || source.backPrompt || source.parentCheck, '家长只问这一题第一步先看什么'),
    nextDayReview: safeText(source.nextDayReview || source.revisit, '明天换一题只复述第一步'),
    route: source.route || '/pages/review/review?from=home_mini_lesson_resume',
    blockedFields: ['原题', '完整答案', '分数', '排名', '天赋标签', '孩子姓名', '家长联系方式']
  };
}

function buildReportServiceResume(input = {}) {
  if (input.reportServiceResume) return input.reportServiceResume;
  const reportState = input.learningReportState || {};
  const handoff = input.uploadReportHandoff || {};
  const servicePathway = input.servicePathway || reportState.servicePathway || handoff.servicePathway || null;
  const ledger = servicePathway && servicePathway.partnerServiceDeliveryLedger
    ? servicePathway.partnerServiceDeliveryLedger
    : null;
  const parentConfirmed = !!(
    reportState.parentConfirmed ||
    handoff.parentConfirmed ||
    input.parentConfirmed ||
    (ledger && ledger.status === 'deliverable_after_parent_confirmation')
  );
  if (!servicePathway && !handoff.title && !reportState.reportDraft) return null;
  const primaryMode = servicePathway && servicePathway.primaryMode ? servicePathway.primaryMode : {};
  const validationPlan = servicePathway && Array.isArray(servicePathway.validationPlan)
    ? servicePathway.validationPlan
    : [];
  const firstValidation = validationPlan[0] || {};
  return {
    id: 'home_report_service_resume',
    title: safeText(handoff.title || '继续家庭方案验证', '继续家庭方案验证'),
    statusLine: parentConfirmed
      ? '家长已确认交付范围，可以进入7天验证。'
      : '家长还未确认交付范围，先确认再进入合作交付。',
    modeLine: primaryMode.label
      ? `建议模式：${safeText(primaryMode.label, '苏格拉底1对1')}`
      : '建议模式：先用苏格拉底1对1，必要时补小讲堂。',
    actionLine: safeText(
      firstValidation.action || (servicePathway && servicePathway.nextAction) || handoff.line,
      '今晚只做一个最小动作，并留下孩子自己的第一步证据。'
    ),
    parentGateLine: parentConfirmed
      ? '放行：只交付行动、家长问题和下一条证据。'
      : '待确认：不向合作方交付原题、答案、分数、排名、姓名或联系方式。',
    cta: parentConfirmed ? '继续7天验证' : '去确认交付范围',
    route: parentConfirmed
      ? '/pages/profile/profile?from=home_report_service_resume'
      : '/pages/upload/upload?from=home_report_service_resume',
    blockedFields: ['原题', '完整答案', '照片', '分数', '排名', '天赋标签', '姓名', '联系方式']
  };
}

function buildPrimaryHomeNextAction(input = {}) {
  const candidates = [];
  if (input.reportServiceResume) {
    candidates.push({
      type: 'report_action',
      priority: 10,
      dispatchCode: 1,
      kicker: '报告建议',
      title: safeText(input.reportServiceResume.title, '继续家庭方案验证'),
      body: safeText(input.reportServiceResume.actionLine || input.reportServiceResume.statusLine, '今晚只做一个最小动作。'),
      cta: safeText(input.reportServiceResume.cta, '继续行动')
    });
  }
  if (input.miniLessonResume) {
    candidates.push({
      type: 'mini_lesson',
      priority: 20,
      dispatchCode: 2,
      kicker: '3 分钟小课堂',
      title: safeText(input.miniLessonResume.topicLabel || input.miniLessonResume.title, '继续小课堂'),
      body: `小黑板：${safeText(input.miniLessonResume.blackboardLine, '先说出第一步')}`,
      cta: '继续小课堂'
    });
  }
  if (input.yesterdayReviewCard) {
    candidates.push({
      type: 'review_return',
      priority: 30,
      dispatchCode: 3,
      kicker: '轻回访',
      title: safeText(input.yesterdayReviewCard.noticeText, '接上昨天那一步'),
      body: safeText(input.yesterdayReviewCard.childArticulatedStep, '先复述昨天的第一步。'),
      cta: '继续回访'
    });
  }
  if (input.incomingShareRelay) {
    const receiverAction = input.incomingShareRelay.defaultReceiverAction || {};
    candidates.push({
      type: 'share_return',
      priority: 40,
      dispatchCode: 4,
      kicker: '学习复盘卡',
      title: safeText(input.incomingShareRelay.title || input.incomingShareRelay.defaultReceiverActionTitle, '接住一个学习动作'),
      body: safeText(input.incomingShareRelay.defaultReceiverActionLine || input.incomingShareRelay.summary, '只接第一步、错因和回访动作。'),
      cta: safeText(receiverAction.displayLabel, '接力这一小步')
    });
  }
  if (input.todayFocus) {
    candidates.push({
      type: 'first_step',
      priority: 50,
      dispatchCode: 5,
      kicker: '今晚路线',
      title: '接上已经确认的第一步',
      body: safeText(input.todayFocus.systemSuggestedStep || input.todayFocus.childArticulatedStep, '先把这一小步做完。'),
      cta: '去专注舱'
    });
  }
  const selected = candidates.sort((a, b) => a.priority - b.priority)[0];
  const fallback = selected || {
    type: 'first_step',
    priority: 90,
    dispatchCode: 6,
    kicker: '今晚路线',
    title: '今晚作业先从哪一步开始？',
    body: '发作业清单，或者说一句你卡在哪里。',
    cta: '帮我安排今晚学习'
  };
  return {
    priority: fallback.priority,
    dispatchCode: fallback.dispatchCode,
    kicker: fallback.kicker,
    title: fallback.title,
    body: fallback.body,
    cta: fallback.cta
  };
}

function buildHomeViewModel(input = {}) {
  const hasPlanOrFocus = !!(input.tonightPlan || input.todayFocus);
  const miniLessonResume = buildMiniLessonResume(input);
  const reportServiceResume = buildReportServiceResume(input);
  const primaryNextAction = buildPrimaryHomeNextAction(Object.assign({}, input, {
    miniLessonResume,
    reportServiceResume
  }));
  return {
    routePill: '今晚路线 · 第 1 步：排顺序',
    companionStrip: companionStrip(input.companionPreference),
    title: '今晚作业先从哪一步开始？',
    subtitle: '发作业清单，或者说一句你卡在哪里。',
    inputCard: {
      title: '把今晚作业或卡住点发过来',
      placeholder: '比如：数学 8 道明天交；或者：我写到第二步就乱了。',
      helper: hasPlanOrFocus
        ? '先说作业、第一步或卡住点。'
        : '咕点不会直接给答案，只陪你先找到第一步。'
    },
    primaryCta: '帮我安排今晚学习',
    secondaryAction: '我已经卡住了',
    teacherPickerLabel: '咕点在旁边',
    teacherPickerHint: '我懂你卡住了，我陪你先迈出第一步。',
    selectedCompanionLabel: safeText((companionPreference(input.companionPreference) || {}).selectedLabel, '咕点'),
    emptyState: hasPlanOrFocus ? null : '还没有今晚路线。咕点在旁边，先说一句卡在哪里。',
    primaryNextAction,
    nextStep: buildNextStep(Object.assign({}, input, { miniLessonResume })),
    miniLessonResume,
    reportServiceResume,
    debugWarnings: []
  };
}

module.exports = {
  buildHomeViewModel,
  buildPrimaryHomeNextAction
};
