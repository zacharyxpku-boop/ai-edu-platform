'use strict';

const core = require('./lobster-core.cjs');
const onboarding = require('./lobster-onboarding.cjs');

function asText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function asList(value) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).slice(0, 8);
  return asText(value)
    .split(/[,，、\s]+/)
    .map(asText)
    .filter(Boolean)
    .slice(0, 8);
}

function detectEmotion(input = {}) {
  const text = [
    input.parentObservation,
    input.childMessage,
    input.childNeed,
    input.latestEvent,
    input.message
  ].map(asText).join(' ');
  if (/哭|崩溃|焦虑|害怕|不想学|生气|吵|急|怕|frustrated|anxious|cry|angry/i.test(text)) {
    return {
      level: 'high',
      label: 'needs_co_regulation',
      teacherMove: '先稳住情绪，再处理题目；家长先陪孩子复述卡点，不急着纠错。',
      childLine: '你不用马上会。先告诉我：你是读不懂题，还是不知道第一步？'
    };
  }
  if (/拖拉|磨蹭|慢|走神|不专心|拖延|tired|slow/i.test(text)) {
    return {
      level: 'medium',
      label: 'needs_short_rhythm',
      teacherMove: '把任务压到 8-12 分钟，先完成一个可见动作，再休息。',
      childLine: '我们只做第一小步。你先圈出题目里最重要的三个词。'
    };
  }
  return {
    level: 'normal',
    label: 'ready_for_first_step',
    teacherMove: '直接进入第一步追问，保持低压反馈。',
    childLine: '你先说准备从哪里开始，我只帮你检查第一步。'
  };
}

function buildFollowUpPlan(input = {}, report = {}) {
  const preferred = asText(input.preferredFollowUpTime || input.followUpTime) || '20:00';
  const nextEvidence = report.summary && Array.isArray(report.summary.nextEvidence)
    ? report.summary.nextEvidence.slice(0, 3)
    : [];
  return {
    cadence: 'daily_light_touch_plus_weekly_report',
    active: true,
    reminders: [
      {
        id: 'tonight_first_step',
        channel: 'parent_device',
        time: preferred,
        title: '今晚第一步',
        action: '打开孩子共屏模式，让孩子说出第一步。',
        payload: 'co_view_child_mode'
      },
      {
        id: 'tomorrow_revisit',
        channel: 'parent_device',
        time: 'next_day_after_school',
        title: '明天短回访',
        action: '用 3 分钟确认孩子是否还能说出昨天的第一步。',
        payload: 'short_revisit'
      },
      {
        id: 'weekly_parent_report',
        channel: 'parent_device',
        time: 'sunday_evening',
        title: '每周家长报告',
        action: '汇总成绩、错题、情绪和陪学记录，生成下一周计划。',
        payload: 'weekly_report'
      }
    ],
    evidenceQueue: nextEvidence.length ? nextEvidence : [
      'Collect one first-step attempt in the child words.',
      'Record one wrong-cause guess after the child calms down.',
      'Check one similar question tomorrow without adding extra workload.'
    ],
    platformBoundary: {
      scheduledByLobsterService: true,
      parentDeviceDeliveryFirst: true,
      externalChannelAdaptersOptional: true
    }
  };
}

function buildUnifiedTeacherWorkspace(input = {}) {
  const familyName = asText(input.familyName) || '家庭学习空间';
  const childAlias = asText(input.childAlias) || '孩子';
  const subjects = asList(input.subjects || input.subjectFocus || '数学');
  const activation = onboarding.buildActivationPackage(Object.assign({
    familyName,
    childAlias,
    subjects,
    childChannel: 'parent_device'
  }, input));
  const parentReport = core.buildParentLobsterReport({
    role: 'parent',
    message: input.parentMaterial || input.parentObservation || input.latestEvent || input.message || '家长希望先知道今晚怎么陪孩子完成第一步。',
    parentObservation: input.parentObservation || input.latestEvent || '',
    scoreRecords: input.scoreRecords || []
  });
  const childReply = core.buildChildLobsterReply({
    role: 'child',
    message: input.childMessage || input.childNeed || '我不知道第一步。',
    taskType: input.taskType || 'homework_first_step',
    subject: subjects[0] || ''
  });
  const emotion = detectEmotion(input);
  const followUpPlan = buildFollowUpPlan(input, parentReport);

  return {
    ok: true,
    schema_id: 'lobster_unified_teacher_workspace_v1',
    productName: '龙虾 AI 教师',
    positioning: '家长设备里的统一 AI 教师：家长看报告，孩子共屏说第一步，系统主动安排短跟进。',
    activationId: activation.activationId,
    entry: activation.userCanFindProductAt,
    deviceModel: {
      primaryDevice: 'parent_phone_or_computer',
      childAccess: 'co_view_or_parent_supervised_session',
      childIndependentAccountRequired: false,
      installModes: ['web_h5', 'desktop_shortcut', 'future_channel_adapter']
    },
    teacherLoop: [
      'parent_intake',
      'emotional_check_in',
      'co_view_child_first_step',
      'parent_decision_report',
      'scheduled_follow_up',
      'weekly_evidence_review'
    ],
    modes: {
      parent: {
        title: '家长教师台',
        purpose: '接收成绩、错题、老师反馈和家长观察，输出今晚怎么陪。',
        reportSummary: parentReport.summary,
        firstAction: parentReport.summary && parentReport.summary.oneSentenceDecision
      },
      childCoView: {
        title: '孩子共屏模式',
        purpose: '在家长设备上给孩子 3-8 分钟低压追问，不直接给答案。',
        teacherReply: childReply.reply,
        childLine: emotion.childLine,
        noFinalAnswer: true
      },
      teacherPresence: {
        title: '真人教师感',
        emotionalCompanion: emotion,
        proactiveFollowUp: followUpPlan,
        humanTeacherGapCovered: [
          '情绪先稳住，再进入题目',
          '孩子只需说第一步，不需要独立账号',
          '系统每天安排轻跟进，每周生成家长报告',
          '必要时把证据交给真人老师或学习规划师接手'
        ]
      }
    },
    handoff: {
      parentDeviceUrl: activation.userCanFindProductAt.primary,
      startParentMode: activation.userCanFindProductAt.parentEntry,
      startChildCoViewMode: activation.userCanFindProductAt.childEntry,
      nextBestAction: '让家长先发一次成绩、错题或今晚冲突描述；系统马上生成孩子共屏第一步和明天回访。'
    },
    safety: {
      childNoFinalAnswer: true,
      parentNoScorePromise: true,
      parentControlsDevice: true,
      externalChatBotNotRequiredForMvp: true,
      rawDialogueStored: false
    },
    raw: {
      activation,
      parentReport,
      childReply
    }
  };
}

module.exports = {
  buildUnifiedTeacherWorkspace,
  detectEmotion,
  buildFollowUpPlan
};
