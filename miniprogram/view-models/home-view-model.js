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

function buildHomeViewModel(input = {}) {
  const hasPlanOrFocus = !!(input.tonightPlan || input.todayFocus);
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
    nextStep: buildNextStep(input),
    debugWarnings: []
  };
}

module.exports = {
  buildHomeViewModel
};
