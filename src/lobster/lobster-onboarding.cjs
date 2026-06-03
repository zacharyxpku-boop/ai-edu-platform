'use strict';

const core = require('./lobster-core.cjs');

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

function safeId(value, fallback = 'family') {
  const text = asText(value) || fallback;
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || fallback;
}

function normalizeChildChannel(input = {}) {
  const raw = [input.childChannel, input.childDevice, input.device, input.deliveryChannel].map(asText).join(' ').toLowerCase();
  if (/feishu|lark|飞书/.test(raw)) return 'feishu';
  if (/dingtalk|ding|钉钉/.test(raw)) return 'dingtalk';
  if (/qq/.test(raw)) return 'qq';
  if (/watch|手表|小天才|xiaotiancai|imoo|okii/.test(raw)) return 'xiaotiancai';
  if (/wechat|微信/.test(raw)) return 'wechat_h5';
  if (/tablet|pad|电脑|pc|web|网页|平板/.test(raw)) return 'web_h5';
  return 'web_h5';
}

function normalizeDeliveryChannel(input = {}) {
  const raw = [input.deliveryChannel, input.parentChannel, input.channel].map(asText).join(' ').toLowerCase();
  if (/feishu|lark|飞书/.test(raw)) return 'feishu';
  if (/dingtalk|ding|钉钉/.test(raw)) return 'dingtalk';
  if (/wechat|wecom|微信|企微|企业微信/.test(raw)) return 'wechat_future';
  return 'web';
}

function buildParentChannel(input = {}) {
  const channel = normalizeDeliveryChannel(input);
  if (channel === 'feishu') {
    return {
      channel: 'feishu-official-bot',
      status: 'adapter_ready_for_pilot',
      entryLabel: '飞书群里的龙虾 AI 教师',
      webhook: '/api/lobster-message?mode=channel&channel=feishu',
      sendApi: '/api/lobster-message?mode=channel&action=send_plan',
      setupSteps: [
        '在飞书开放平台创建企业自建应用。',
        '开启机器人和接收消息事件。',
        '把 Request URL 配置为 /api/lobster-message?mode=channel&channel=feishu。',
        '家长或老师在群里发送成绩、错题或观察，龙虾返回报告和今晚动作。'
      ],
      boundary: {
        officialBotOnly: true,
        tokenStoredServerSideOnly: true,
        noPersonalWechatBot: true
      }
    };
  }
  if (channel === 'dingtalk') {
    return {
      channel: 'dingtalk-official-bot',
      status: 'adapter_ready_for_pilot',
      entryLabel: '钉钉群里的龙虾 AI 教师',
      webhook: '/api/lobster-message?mode=channel&channel=dingtalk',
      sendApi: '/api/lobster-message?mode=channel&action=send_plan',
      setupSteps: [
        '在钉钉开放平台创建应用机器人。',
        '配置机器人消息回调地址。',
        '把回调地址配置为 /api/lobster-message?mode=channel&channel=dingtalk。',
        '家长、老师或运营在群里发送材料，龙虾返回可执行反馈。'
      ],
      boundary: {
        officialBotOnly: true,
        tokenStoredServerSideOnly: true,
        noUnofficialProtocol: true
      }
    };
  }
  if (channel === 'wechat_future') {
    return {
      channel: 'wechat-official-adapter-deferred',
      status: 'deferred_until_official_wechat_flow',
      entryLabel: '微信官方服务流',
      webhook: '',
      sendApi: '',
      setupSteps: [
        '先用官网、飞书、钉钉跑通产品闭环。',
        '后续只通过公众号、小程序客服、订阅消息或企业微信接入。',
        '不做个人微信号外挂机器人。'
      ],
      boundary: {
        noPersonalWechatBot: true,
        noUnofficialProtocol: true,
        proactivePushLimitedByPlatformRules: true
      }
    };
  }
  return {
    channel: 'web-parent-device',
    status: 'ready_for_mvp',
    entryLabel: '家长手机、平板或电脑里的龙虾配置页',
    webhook: '/lobster.html',
    sendApi: '',
    setupSteps: [
      'Parent opens /lobster.html from the official website.',
      'Parent confirms grade, subjects, recent scores, and parent goal.',
      'Child uses co-view mode on the parent device.',
      'Parent checks the report and next follow-up action.'
    ],
    boundary: {
      noInstallNeeded: true,
      childIndependentAccountRequired: false,
      noPersonalWechatBot: true
    }
  };
}

function buildChildChannel(input = {}) {
  const channel = normalizeChildChannel(input);
  if (channel === 'feishu') {
    return {
      channel: 'feishu-official-bot',
      status: 'adapter_ready_for_pilot',
      entryLabel: '飞书机器人里的孩子共屏/提问入口',
      setupSteps: [
        'Guardian or teacher adds the Feishu bot to the learning group.',
        'Child question is sent under adult supervision or by the parent.',
        'The adapter forwards messages to the same Lobster core service.',
        'Child Lobster asks for the first step and does not give final answers.'
      ],
      boundary: {
        officialBotOnly: true,
        guardianConsentRequired: true,
        noFinalAnswerForChild: true
      }
    };
  }
  if (channel === 'dingtalk') {
    return {
      channel: 'dingtalk-official-bot',
      status: 'adapter_ready_for_pilot',
      entryLabel: '钉钉机器人里的孩子共屏/提问入口',
      setupSteps: [
        'Teacher, institution, or parent adds the DingTalk app bot.',
        'Homework blocker is sent to the bot.',
        'The bot forwards the text to Lobster.',
        'Child Lobster returns a first-step prompt, not a final answer.'
      ],
      boundary: {
        officialBotOnly: true,
        guardianConsentRequired: true,
        noFinalAnswerForChild: true
      }
    };
  }
  if (channel === 'qq') {
    return {
      channel: 'qq-official-bot',
      status: 'phase_2_adapter_required',
      entryLabel: 'QQ 官方机器人里的孩子龙虾',
      setupSteps: [
        'Parent confirms the child may use QQ for learning chat.',
        'Bind the family activation id to the QQ official bot account.',
        'Child sends homework blockers to Child Lobster.',
        'The QQ adapter forwards messages to the same Lobster core service.'
      ],
      boundary: {
        officialBotOnly: true,
        guardianConsentRequired: true,
        noUnofficialQQProtocol: true
      }
    };
  }
  if (channel === 'xiaotiancai') {
    return {
      channel: 'xiaotiancai-open-platform',
      status: 'partner_review_required',
      entryLabel: '小天才开放平台应用/服务号里的孩子龙虾',
      setupSteps: [
        'Use the web child entry for the pilot.',
        'Prepare child-safe content, privacy, and audit materials.',
        'Submit the Lobster child entry through the device open platform.',
        'After approval, bind the device-side app or service account to the family activation id.'
      ],
      boundary: {
        openPlatformReviewRequired: true,
        noSideloadPromise: true,
        childPrivacyReviewRequired: true
      }
    };
  }
  if (channel === 'wechat_h5') {
    return {
      channel: 'wechat-web-h5',
      status: 'deferred_until_official_wechat_flow',
      entryLabel: '微信内打开的孩子龙虾 H5 入口',
      setupSteps: [
        'Use web or official miniapp service flow only.',
        'Do not use personal WeChat bot automation.',
        'Child opens the supervised H5 link when parent allows.',
        'Child Lobster asks for the first step and does not give final answers.'
      ],
      boundary: {
        noPersonalWechatBot: true,
        parentCanSupervise: true,
        noFinalAnswerForChild: true
      }
    };
  }
  return {
    channel: 'web-h5',
    status: 'ready_for_mvp',
    entryLabel: '浏览器/平板里的孩子龙虾 H5 入口',
    setupSteps: [
      'Parent copies or shares the child entry link.',
      'Child opens it on tablet, computer, or parent-approved device.',
      'Child sends the stuck point or first-step attempt.',
      'Child Lobster asks one guiding question and returns to child action.'
    ],
    boundary: {
      parentCanSupervise: true,
      noInstallNeeded: true,
      noFinalAnswerForChild: true
    }
  };
}

function buildActivationPackage(input = {}) {
  const familyName = asText(input.familyName) || '家庭学习空间';
  const childAlias = asText(input.childAlias) || '孩子';
  const gradeBand = asText(input.gradeBand || input.grade) || '未填写年级';
  const subjects = asList(input.subjects || input.subjectFocus || '数学');
  const parentGoal = asText(input.parentGoal) || '先把今晚能执行的一步定下来';
  const childNeed = asText(input.childNeed || input.childProblem) || '卡住时有人追问第一步';
  const activationSeed = safeId(input.activationId || `${familyName}-${childAlias}-${gradeBand}`, 'lobster-family');
  const activationId = `lobster-${activationSeed}`;
  const parentChannel = buildParentChannel(input);
  const childChannel = buildChildChannel(input);
  const config = core.configureLobsterPair({
    productId: 'lobster-family-learning',
    child: {
      displayName: `${childAlias}的孩子龙虾`,
      gradeBand,
      subjectFocus: subjects
    },
    parent: {
      displayName: `${familyName}的家长龙虾`,
      gradeBand,
      subjectFocus: subjects
    }
  });

  return {
    ok: true,
    schema_id: 'lobster_activation_v1',
    activationId,
    productName: '龙虾家庭学习双代理',
    familyName,
    userCanFindProductAt: {
      primary: `/lobster.html#activate=${encodeURIComponent(activationId)}`,
      parentEntry: `/lobster.html?role=parent&activation=${encodeURIComponent(activationId)}`,
      childEntry: `/lobster.html?role=child&activation=${encodeURIComponent(activationId)}`,
      api: '/api/lobster-onboarding'
    },
    configuration: {
      gradeBand,
      subjects,
      parentGoal,
      childNeed,
      parentChannel,
      childChannel
    },
    agents: {
      parent: {
        lobsterId: `${activationId}-parent`,
        displayName: config.parent.displayName,
        role: 'analyze_scores_wrong_questions_and_parent_observations',
        firstMessage: `我想先看${childAlias}最近的成绩、错题或老师反馈，然后给你一份今晚行动建议。`
      },
      child: {
        lobsterId: `${activationId}-child`,
        displayName: config.child.displayName,
        role: 'socratic_first_step_teacher',
        firstMessage: '把你卡住的题目或第一步发给我，我只帮你找到下一步，不直接替你写答案。'
      }
    },
    shareKit: {
      parentInviteText: `我已开通${familyName}的家长龙虾：先发一次成绩或错题，就能得到今晚行动建议。`,
      childInviteText: `${childAlias}，这是你的孩子龙虾。遇到不会的题，先发“我卡在哪里”，它会像老师一样追问第一步。`,
      salesLine: '家长从官网配置，飞书/钉钉先跑通官方机器人闭环，微信只走后续官方服务流。'
    },
    nextActions: [
      'Give the parent the primary activation link.',
      'Parent confirms the family profile.',
      'Parent sends one score or wrong-question sample to Parent Lobster.',
      'If using Feishu or DingTalk, configure the official bot webhook.',
      'Child sends one stuck point to Child Lobster under supervision.',
      'System returns parent report plus child first-step guidance.'
    ],
    safety: {
      childNoFinalAnswer: true,
      parentNoScorePromise: true,
      channelAdaptersUseOfficialRoutesOnly: true,
      rawDialogueStored: false
    },
    lobsterConfig: {
      productId: config.productId,
      child: config.child,
      parent: config.parent,
      warnings: config.warnings
    }
  };
}

module.exports = {
  buildActivationPackage,
  normalizeChildChannel,
  normalizeDeliveryChannel,
  buildParentChannel,
  buildChildChannel
};
