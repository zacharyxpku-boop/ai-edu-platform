const storage = require('../utils/storage');

const UNSAFE_KEY_RE = /^[a-z]+(?:_[a-z0-9]+)+$|[a-z]+[A-Z][a-zA-Z]+/;

function safeText(value, fallback = '修过的第一步') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || UNSAFE_KEY_RE.test(text)) return fallback;
  return text.slice(0, 100);
}

function companionPreference(input) {
  if (storage.buildCompanionPreference) return storage.buildCompanionPreference(input || {});
  return Object.assign({ selectedCompanion: 'gudian', selectedLabel: '咕点' }, input || {});
}

function companionStrip(input, hasEvidence) {
  const preference = companionPreference(input);
  const line = storage.getCompanionStageCopy
    ? storage.getCompanionStageCopy(hasEvidence ? 'revisit_recall' : 'revisit_empty', preference)
    : '咕点陪你轻轻回访昨天那一步。';
  return safeText(line, '咕点陪你轻轻回访昨天那一步。');
}

function firstReviewCard(input) {
  const cards = input && (input.reviewCards || input.focusDueReviewCards);
  if (Array.isArray(cards) && cards.length) return cards[0];
  return (input && input.reviewCard) || null;
}

function evidenceFromSession(session) {
  if (!session) return null;
  const target = session.focusTarget || {};
  const step = session.linkedChildArticulatedStep
    || target.linkedChildArticulatedStep
    || session.linkedSystemSuggestedStep
    || target.linkedSystemSuggestedStep
    || target.title
    || '';
  if (!step) return null;
  const interrupted = session.completionType === 'interrupted' || session.status === 'interrupted';
  return {
    hasEvidence: true,
    step: safeText(step, '昨天那一步'),
    completionType: interrupted ? 'interrupted' : 'completed',
    intro: interrupted
      ? '昨天我们停在这里，今天轻轻接一下。'
      : '昨天这一步你已经坐过一段，今天只轻轻回看一下。',
    source: 'focus_session'
  };
}

function evidenceFromReviewCard(input) {
  const card = firstReviewCard(input);
  if (!card || !(card.front || card.title || card.backPrompt)) return null;
  return {
    hasEvidence: true,
    step: safeText(card.front || card.title, '昨天那一步'),
    completionType: 'review_card',
    intro: '昨天这一步已经留下卡片，今天只轻轻回看一下。',
    source: 'review_card'
  };
}

function latestEvidence(input) {
  return evidenceFromSession(input && input.latestFocusSession)
    || evidenceFromSession(input && Array.isArray(input.focusHistory) && input.focusHistory[0])
    || evidenceFromReviewCard(input)
    || null;
}

function buildPrimaryCard(input) {
  const evidence = latestEvidence(input || {});
  if (!evidence) {
    return {
      title: '还没有可回访的第一步',
      body: '先完成一次“说出第一步 + 围绕它坐一段”，明天这里会带你轻轻回看。',
      reviewTitle: '修过的第一步',
      hasReviewCard: false,
      questions: []
    };
  }
  return {
    title: '回看昨天那一步',
    body: evidence.intro,
    reviewTitle: evidence.step,
    hasReviewCard: true,
    evidence,
    questions: [
      '昨天你第一步先看了哪里？',
      '今天再看这一步，还顺吗？',
      '要不要把昨天那一步再坐 5 分钟？'
    ]
  };
}

function buildPrimaryCta(hasReviewCard) {
  return hasReviewCard
    ? { text: '轻轻回看', action: 'review' }
    : { text: '先去说第一步', action: 'review' };
}

function buildRevisitViewModel(input = {}) {
  const primaryCard = buildPrimaryCard(input);
  return {
    routePill: '今晚路线 · 第 4 步：明天轻轻回访',
    companionStrip: companionStrip(input.companionPreference, primaryCard.hasReviewCard),
    title: '今天只回看这一小步',
    subtitle: '不是测验，不翻旧账，只把昨天开始过的第一步轻轻接回来。',
    primaryCard,
    primaryCta: buildPrimaryCta(primaryCard.hasReviewCard),
    emptyState: primaryCard.hasReviewCard ? null : primaryCard.body,
    nextStep: primaryCard.hasReviewCard
      ? {
          text: '下一步：让家长 5 秒看懂今晚问哪一句。',
          cta: '去我的页',
          action: 'profile'
        }
      : null,
    quickSections: [
      { id: 'light', title: '明天轻轻回访', collapsed: true },
      { id: 'custom', title: '自选练习先收起', collapsed: true }
    ],
    debugWarnings: []
  };
}

module.exports = {
  buildRevisitViewModel
};
