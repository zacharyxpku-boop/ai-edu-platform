'use strict';

const lobster = require('./lobster-core.cjs');

const CHANNELS = {
  feishu: {
    id: 'feishu',
    label: '飞书',
    webhookPath: '/api/lobster-message?mode=channel&channel=feishu',
    officialOnly: true,
    bestFor: '机构、老师、运营协助版',
    tokenEnv: ['FEISHU_TENANT_ACCESS_TOKEN', 'LARK_TENANT_ACCESS_TOKEN']
  },
  dingtalk: {
    id: 'dingtalk',
    label: '钉钉',
    webhookPath: '/api/lobster-message?mode=channel&channel=dingtalk',
    officialOnly: true,
    bestFor: '学校、机构、班级群',
    tokenEnv: ['DINGTALK_ACCESS_TOKEN', 'DINGTALK_ROBOT_TOKEN']
  },
  web: {
    id: 'web',
    label: '官网/Web',
    webhookPath: '/lobster.html',
    officialOnly: true,
    bestFor: '普通家庭先跑通',
    tokenEnv: []
  },
  wechat_future: {
    id: 'wechat_future',
    label: '微信后续官方适配',
    webhookPath: '',
    officialOnly: true,
    bestFor: 'C 端家长主入口',
    tokenEnv: []
  }
};

function asText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function safeChannel(value) {
  const raw = asText(value).toLowerCase();
  if (/lark/.test(raw)) return 'feishu';
  if (/ding/.test(raw) || /钉/.test(raw)) return 'dingtalk';
  if (Object.prototype.hasOwnProperty.call(CHANNELS, raw)) return raw;
  return 'web';
}

function parseJsonMaybe(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return {};
  }
}

function detectRole(text, explicitRole) {
  const explicit = asText(explicitRole).toLowerCase();
  if (explicit === 'parent' || explicit === 'child') return explicit;
  if (/成绩|分数|错题|老师|报告|家长|观察|焦虑|冲突|陪|作业/.test(text)) return 'parent';
  return 'child';
}

function normalizeFeishu(body = {}) {
  if (body.type === 'url_verification' && body.challenge) {
    return {
      channel: 'feishu',
      verification: true,
      response: { challenge: body.challenge }
    };
  }
  const event = body.event || {};
  const message = event.message || body.message || {};
  const content = parseJsonMaybe(message.content);
  const text = asText(content.text || content.content || message.text || body.text || body.messageText);
  return {
    channel: 'feishu',
    platformMessageId: asText(message.message_id || body.message_id),
    conversationId: asText(message.chat_id || body.chat_id),
    senderId: asText(
      (event.sender && event.sender.sender_id && (event.sender.sender_id.open_id || event.sender.sender_id.user_id)) ||
      body.open_id ||
      body.senderId
    ),
    text,
    role: detectRole(text, body.role),
    rawType: asText(body.type || event.type || body.header && body.header.event_type)
  };
}

function normalizeDingTalk(body = {}) {
  const textNode = body.text || {};
  const text = asText(textNode.content || body.content || body.message || body.messageText);
  return {
    channel: 'dingtalk',
    platformMessageId: asText(body.msgId || body.messageId || body.message_id),
    conversationId: asText(body.conversationId || body.conversation_id || body.openConversationId),
    senderId: asText(body.senderStaffId || body.senderId || body.senderNick),
    text,
    role: detectRole(text, body.role),
    rawType: asText(body.msgtype || body.messageType || 'text')
  };
}

function normalizeWeb(body = {}) {
  const text = asText(body.message || body.text || body.parentObservation || body.childMessage);
  return {
    channel: safeChannel(body.channel || 'web'),
    platformMessageId: asText(body.messageId || body.message_id),
    conversationId: asText(body.familyId || body.conversationId || body.activationId),
    senderId: asText(body.senderId || body.familyName),
    text,
    role: detectRole(text, body.role),
    rawType: 'web'
  };
}

function normalizeInboundMessage(channel, body = {}) {
  const safe = safeChannel(channel || body.channel);
  if (safe === 'feishu') return normalizeFeishu(body);
  if (safe === 'dingtalk') return normalizeDingTalk(body);
  return normalizeWeb(Object.assign({}, body, { channel: safe }));
}

function summarizeResult(result = {}) {
  if (result.audience === 'parent' && result.summary) {
    const actions = Array.isArray(result.summary.tonightAction) ? result.summary.tonightAction.slice(0, 3) : [];
    return [
      `家长龙虾：${result.summary.oneSentenceDecision || '今晚先收一条真实学习证据。'}`,
      actions.length ? `今晚动作：${actions.join('；')}` : '',
      '边界：不评价孩子能力，不加题量，先看第一步证据。'
    ].filter(Boolean).join('\n');
  }
  return [
    `孩子龙虾：${result.reply || '你先说第一步，不用直接算完。'}`,
    '边界：我会追问和提示，不直接给最终答案。'
  ].join('\n');
}

function buildChannelResponse(inbound = {}, options = {}) {
  if (inbound.verification) {
    return {
      ok: true,
      channel: inbound.channel,
      verification: true,
      response: inbound.response
    };
  }
  const message = asText(inbound.text);
  if (!message) {
    return {
      ok: false,
      channel: inbound.channel,
      error: 'message_required'
    };
  }
  const result = lobster.routeLobsterMessage({
    role: inbound.role,
    message,
    parentObservation: inbound.role === 'parent' ? message : options.parentObservation,
    childMessage: inbound.role === 'child' ? message : options.childMessage,
    materialText: message,
    familyName: options.familyName || inbound.conversationId || 'channel-family'
  });
  const replyText = summarizeResult(result);
  return {
    ok: true,
    schema_id: 'lobster_channel_response_v1',
    channel: inbound.channel,
    role: inbound.role,
    conversationId: inbound.conversationId,
    senderIdStored: false,
    rawDialogueStored: false,
    inbound: {
      hasText: true,
      platformMessageId: inbound.platformMessageId ? 'present' : '',
      rawIncluded: false
    },
    lobster: {
      audience: result.audience,
      displayName: result.displayName,
      noFinalAnswer: Boolean(result.teacherMode && result.teacherMode.noFinalAnswer)
    },
    replyText,
    platformReply: buildPlatformReply(inbound.channel, replyText, inbound),
    sendPlan: buildOutboundPlan(inbound.channel, {
      conversationId: inbound.conversationId,
      text: replyText
    })
  };
}

function buildPlatformReply(channel, text, inbound = {}) {
  const safe = safeChannel(channel);
  if (safe === 'feishu') {
    return {
      msg_type: 'text',
      content: JSON.stringify({ text }),
      receive_id_type: inbound.conversationId ? 'chat_id' : 'open_id',
      receive_id: inbound.conversationId || inbound.senderId || ''
    };
  }
  if (safe === 'dingtalk') {
    return {
      msgtype: 'text',
      text: { content: text },
      at: { atUserIds: [], isAtAll: false },
      conversationId: inbound.conversationId || ''
    };
  }
  return { type: 'text', text };
}

function buildOutboundPlan(channel, input = {}) {
  const safe = safeChannel(channel);
  const meta = CHANNELS[safe] || CHANNELS.web;
  const text = asText(input.text);
  const conversationId = asText(input.conversationId);
  if (safe === 'feishu') {
    return {
      ok: true,
      channel: safe,
      officialOnly: true,
      tokenRequired: true,
      tokenEnv: meta.tokenEnv,
      method: 'POST',
      url: 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
      body: {
        receive_id: conversationId,
        msg_type: 'text',
        content: JSON.stringify({ text })
      },
      readyToSend: Boolean(conversationId && text),
      dryRun: true
    };
  }
  if (safe === 'dingtalk') {
    return {
      ok: true,
      channel: safe,
      officialOnly: true,
      tokenRequired: true,
      tokenEnv: meta.tokenEnv,
      method: 'POST',
      url: 'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend',
      body: {
        openConversationId: conversationId,
        msgKey: 'sampleText',
        msgParam: JSON.stringify({ content: text })
      },
      readyToSend: Boolean(conversationId && text),
      dryRun: true
    };
  }
  return {
    ok: true,
    channel: safe,
    officialOnly: true,
    tokenRequired: false,
    url: '/lobster.html',
    body: { text },
    readyToSend: Boolean(text),
    dryRun: true
  };
}

function listChannelAdapters() {
  return Object.values(CHANNELS).map((item) => ({
    id: item.id,
    label: item.label,
    webhookPath: item.webhookPath,
    officialOnly: item.officialOnly,
    bestFor: item.bestFor,
    tokenEnv: item.tokenEnv.slice()
  }));
}

module.exports = {
  CHANNELS,
  safeChannel,
  normalizeInboundMessage,
  buildChannelResponse,
  buildPlatformReply,
  buildOutboundPlan,
  listChannelAdapters
};
