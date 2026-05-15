const storage = require('../utils/storage');

const UNSAFE_KEY_RE = /^[a-z]+(?:_[a-z0-9]+)+$|[a-z]+[A-Z][a-zA-Z]+/;

function safeText(value, fallback = '先说第一步') {
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
  const line = storage.getCompanionStageCopy
    ? storage.getCompanionStageCopy('review_focus', preference)
    : '咕点陪你只修这一小步，不讲完整答案。';
  return safeText(line, '咕点陪你只修今晚最卡的这一小步。');
}

function issueLabel(todayFocus) {
  const focus = todayFocus || {};
  const formattedIssue = storage.formatIssueType
    ? storage.formatIssueType(focus.issueType || '', '思路卡点')
    : safeText(focus.issueType, '思路卡点');
  return safeText(formattedIssue, '思路卡点');
}

function focusEvidence(todayFocus) {
  if (storage.normalizeFirstStepEvidence) return storage.normalizeFirstStepEvidence(todayFocus || {});
  return {
    systemSuggestedStep: todayFocus && todayFocus.miniActionText || '先把题目问什么说出来。',
    childArticulatedStep: todayFocus && todayFocus.childArticulatedStep || '',
    childStepQuality: 'empty',
    quickChoices: []
  };
}

function buildPrimaryCard(input) {
  const todayFocus = input && input.todayFocus;
  if (!todayFocus) {
    return {
      title: '只修一个真实卡点',
      sections: []
    };
  }
  const blackboard = storage.buildBlackboardHint ? storage.buildBlackboardHint(todayFocus) : null;
  const evidence = focusEvidence(todayFocus);
  return {
    title: '只修一个真实卡点',
    firstStepEvidence: {
      systemSuggestedStep: evidence.systemSuggestedStep || '',
      childArticulatedStep: evidence.childArticulatedStep || '',
      childStepQuality: evidence.childStepQuality || 'empty',
      quickChoices: evidence.quickChoices || []
    },
    sections: [
      {
        id: 'where',
        label: '今天卡在哪',
        text: `你不是整题不会，只是卡在：${issueLabel(todayFocus)}。`
      },
      {
        id: 'look',
        label: '先看哪里',
        text: blackboard ? blackboard.structure : '先看题目问什么，再找第一步。'
      },
      {
        id: 'system-step',
        label: '咕点建议你先看',
        text: evidence.systemSuggestedStep || '先把题目问什么说出来。'
      },
      {
        id: 'child-step',
        label: '你自己的第一步',
        text: evidence.childArticulatedStep || '你可以用自己的话补一句：我先……'
      }
    ]
  };
}

function buildPrimaryCta(todayFocus) {
  if (!todayFocus) return { text: '去说第一步', action: 'home', completed: false };
  if (todayFocus.repairStatus === 'completed') {
    return { text: '今天这个卡点先修到这里', action: 'tools', completed: true };
  }
  if (todayFocus.childArticulatedStep || todayFocus.hasMiniActionDone) {
    return { text: '完成今日修复', action: 'complete', completed: false };
  }
  if (todayFocus.repairStatus === 'in_progress') {
    return { text: '先补一句自己的第一步', action: 'review', completed: false };
  }
  return { text: '开始 5 分钟修复', action: 'review', completed: false };
}

function buildReviewViewModel(input = {}) {
  const todayFocus = input.todayFocus || null;
  const evidence = todayFocus ? focusEvidence(todayFocus) : null;
  const rawBlackboard = todayFocus && todayFocus.repairStatus !== 'not_started' && storage.buildBlackboardHint
    ? storage.buildBlackboardHint(todayFocus)
    : null;
  const blackboard = rawBlackboard
    ? Object.assign({ intro: '我不直接讲答案，只帮你看清第一步。' }, rawBlackboard)
    : null;
  return {
    routePill: '今晚路线 · 第 3 步：修卡点',
    companionStrip: companionStrip(input.companionPreference),
    title: '今晚只修一个卡点',
    subtitle: '不是整题不会，只先把最卡的这一步说清楚。',
    primaryCard: buildPrimaryCard(input),
    blackboard,
    primaryCta: buildPrimaryCta(todayFocus),
    focusCabinCta: todayFocus
      ? {
          text: '进专注舱，咕点陪你做完这一小步',
          action: 'focus'
        }
      : null,
    miniAction: todayFocus && !(evidence && evidence.childArticulatedStep)
      ? {
          question: '你可以用自己的话补一句：我先……',
          helper: '说不完整也没关系，先补一句就好。这不是答案，只是你准备开始的第一步。',
          placeholder: '比如：我先圈出题干条件',
          saveCta: '保存我的第一步',
          quickChoices: evidence ? evidence.quickChoices : []
        }
      : null,
    emptyState: todayFocus ? null : {
      text: '还没有要修的卡点。先回到作业点拨，说一句你卡在哪里。',
      cta: '去说第一步',
      action: 'home'
    },
    nextStep: todayFocus && todayFocus.repairStatus === 'completed'
      ? '已生成明天回访卡。下一步：去轻轻回访。'
      : '',
    debugWarnings: []
  };
}

module.exports = {
  buildReviewViewModel
};
