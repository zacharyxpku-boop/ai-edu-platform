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
    : '咕点陪你只修这一小步，不讲完整结果。';
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

function buildRepairContract(todayFocus) {
  if (!todayFocus) return null;
  const evidence = focusEvidence(todayFocus);
  const issue = issueLabel(todayFocus);
  const childStep = evidence.childArticulatedStep || '';
  const suggestedStep = evidence.systemSuggestedStep || '先把题目问什么说出来。';
  const completed = todayFocus.repairStatus === 'completed';
  return {
    title: completed ? '这次修复已经收口' : '这次只修到这里',
    status: completed ? '已完成' : childStep ? '可完成' : '先补一句',
    rows: [
      {
        id: 'say',
        label: '先说',
        text: childStep || `我先……（参考：${suggestedStep}）`
      },
      {
        id: 'do',
        label: '小动作',
        text: todayFocus.hasMiniActionDone || childStep
          ? `围绕「${issue}」做一道小变式或坐 5 分钟。`
          : '先补一句自己的第一步，再开始修。'
      },
      {
        id: 'tomorrow',
        label: '明天验收',
        text: completed ? '明天只回访同一处第一步，不扩题量。' : '完成后生成明天回访卡。'
      }
    ],
    boundary: '本页只记录第一步、错因和明天回访，不给完整结果，不做分数比较。',
    parentLine: childStep
      ? `家长只问：你刚才第一步为什么先做「${childStep}」？`
      : '家长只问：你第一步准备先看哪里？'
  };
}

function buildVisualBlackboard(todayFocus) {
  if (!todayFocus || todayFocus.repairStatus === 'not_started' || !storage.buildBlackboardHint) return null;
  const rawBlackboard = storage.buildBlackboardHint(todayFocus);
  if (!rawBlackboard) return null;
  let blueprint = null;
  if (storage.buildFirstStepBlackboardBlueprint) {
    try {
      blueprint = storage.buildFirstStepBlackboardBlueprint(todayFocus);
    } catch (error) {
      blueprint = null;
    }
  }
  const rawLayers = blueprint && Array.isArray(blueprint.layers) && blueprint.layers.length
    ? blueprint.layers
    : safeText(rawBlackboard.structure, '第一步 → 证据 → 回访').split('→').slice(0, 3).map((label, index) => ({
      id: `fallback_layer_${index + 1}`,
      order: index + 1,
      label: label.trim(),
      drawAction: index === 0 ? `只标出「${label.trim()}」这一笔` : `再看「${label.trim()}」的证据`,
      evidence: index === 0 ? rawBlackboard.firstMove || rawBlackboard.body || '' : '',
      parentQuestion: index === 0 ? `你第一步先看「${label.trim()}」吗？` : '这一笔有什么证据？'
    }));
  const layers = rawLayers.slice(0, 3).map((layer, index) => ({
    id: layer.id || `layer_${index + 1}`,
    order: Number(layer.order || index + 1),
    label: safeText(layer.label, index === 0 ? '第一步' : '证据'),
    drawAction: safeText(layer.drawAction, `只标出第 ${index + 1} 笔`),
    evidence: safeText(layer.evidence, index === 0 ? '孩子自己的第一步' : '说出这一笔的证据'),
    parentQuestion: safeText(layer.parentQuestion, index === 0 ? '你第一步先看哪里？' : '这一笔有什么证据？')
  }));
  const firstStroke = blueprint && blueprint.firstStroke ? blueprint.firstStroke : null;
  return Object.assign({ intro: '我不直接讲答案，只把第一步画清楚。' }, rawBlackboard, {
    visualMode: 'three_layer_first_step_board',
    blueprintTitle: blueprint && blueprint.title ? blueprint.title : rawBlackboard.title,
    layers,
    firstStrokeLine: firstStroke
      ? `${safeText(firstStroke.drawAction, '只画第一笔')}｜${safeText(firstStroke.childReply, '孩子说出自己的第一步')}`
      : rawBlackboard.firstMove || '',
    stopRuleLine: blueprint && blueprint.stopRule ? blueprint.stopRule : '孩子能说出第一步就停，不继续代讲完整结果。',
    boundaryLine: blueprint && blueprint.boundary ? blueprint.boundary : (rawBlackboard.avoid || '只给第一步，不给完整结果。'),
    nextRevisitLine: blueprint && blueprint.wrongCauseReturn ? blueprint.wrongCauseReturn : '同类题又错时，先回到这一笔，不加题量。',
    localAiSplitLine: blueprint && blueprint.aiRole
      ? `本地代码管层级、停笔和放行；AI 只负责把同一第一步讲得更像孩子听得懂的话。`
      : '本地代码管层级、停笔和放行；AI 只改写同一第一步的表达。'
  });
}

function buildReviewViewModel(input = {}) {
  const todayFocus = input.todayFocus || null;
  const evidence = todayFocus ? focusEvidence(todayFocus) : null;
  const blackboard = buildVisualBlackboard(todayFocus);
  return {
    routePill: '今晚路线 · 第 3 步：修卡点',
    companionStrip: companionStrip(input.companionPreference),
    title: '今晚只修一个卡点',
    subtitle: '不是整题不会，只先把最卡的这一步说清楚。',
    primaryCard: buildPrimaryCard(input),
    repairContract: buildRepairContract(todayFocus),
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
          helper: '说不完整也没关系，先补一句就好。这不是结果，只是你准备开始的第一步。',
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
