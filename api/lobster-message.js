import { createRequire } from 'module';
import { readJsonBody, requestUrl, sendJson, sendOptions } from './lobster-http.js';

const require = createRequire(import.meta.url);
const lobster = require('../src/lobster/lobster-core.cjs');
const channels = require('../src/lobster/lobster-channel-adapter.cjs');

const PROVIDERS = {
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    env: ['DEEPSEEK_KEY', 'DEEPSEEK_API_KEY'],
    model: 'deepseek-chat'
  },
  qwen: {
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    env: ['QWEN_KEY', 'DASHSCOPE_API_KEY'],
    model: 'qwen-plus'
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    env: ['OPENAI_API_KEY'],
    model: 'gpt-4o-mini'
  }
};

function firstEnv(names) {
  if (typeof process === 'undefined' || !process.env) return '';
  for (const name of names || []) {
    if (process.env[name]) return process.env[name];
  }
  return '';
}

function safeProviderName(value) {
  const name = String(value || 'deepseek').toLowerCase();
  return Object.prototype.hasOwnProperty.call(PROVIDERS, name) ? name : 'deepseek';
}

function buildServerModelAdapter(body = {}) {
  if (!body.useServerModel && !body.modelProvider) return null;
  const providerName = safeProviderName(body.modelProvider);
  const provider = PROVIDERS[providerName];
  const key = firstEnv(provider.env);
  if (!key || typeof fetch !== 'function') return null;
  return async function serverModelAdapter(prompt) {
    const response = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: body.model || provider.model,
        temperature: Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : 0.2,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: [prompt.user, (prompt.memoryFacts || []).join('\n')].filter(Boolean).join('\n\nMemory facts:\n') }
        ]
      })
    });
    if (!response.ok) throw new Error(`provider_${providerName}_${response.status}`);
    const data = await response.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';
    return {
      reply,
      provider: providerName,
      model: body.model || provider.model
    };
  };
}

function publicPayload(result) {
  if (!result || typeof result !== 'object') return { ok: false, error: 'empty_lobster_result' };
  const raw = result.raw || {};
  return Object.assign({}, result, {
    ok: true,
    raw: {
      included: false,
      availableForServerDebug: Boolean(raw && Object.keys(raw).length)
    }
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendOptions(res);
  }

  const url = requestUrl(req, 'https://yuandianzhixue.com/api/lobster-message');
  if (req.method === 'GET' && url.searchParams.get('mode') === 'channel') {
    return sendJson(res, 200, {
      ok: true,
      schema_id: 'lobster_channel_webhook_v1',
      adapters: channels.listChannelAdapters(),
      wechatStatus: 'deferred_official_adapter_only'
    });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const body = await readJsonBody(req);
  if (url.searchParams.get('mode') === 'channel' || body.mode === 'channel') {
    if (url.searchParams.get('action') === 'send_plan' || body.action === 'send_plan') {
      const plan = channels.buildOutboundPlan(body.channel || url.searchParams.get('channel') || 'web', body);
      return sendJson(res, 200, {
        ok: true,
        schema_id: 'lobster_channel_send_v1',
        channel: plan.channel,
        tokenConfigured: false,
        tokenExposed: false,
        sent: false,
        reason: 'send_plan_only_configure_platform_token_in_host',
        plan
      });
    }
    const channel = url.searchParams.get('channel') || body.channel || 'web';
    const inbound = channels.normalizeInboundMessage(channel, body);
    const response = channels.buildChannelResponse(inbound, body);
    if (response.verification && response.response) return sendJson(res, 200, response.response);
    return sendJson(res, response.ok ? 200 : 400, response);
  }

  const role = body.role || body.audience || 'child';
  const message = body.message || body.text || body.materialText || '';
  if (!String(message || '').trim()) {
    return sendJson(res, 400, { ok: false, error: 'message_required' });
  }

  try {
    const adapter = buildServerModelAdapter(body);
    const result = await lobster.runLobsterModelAdapter(Object.assign({}, body, { role, message }), adapter);
    const payload = publicPayload(result);
    payload.provider = {
      requested: Boolean(body.useServerModel || body.modelProvider),
      used: Boolean(adapter && result.modelAdapterUsed),
      name: adapter ? safeProviderName(body.modelProvider) : '',
      keyExposed: false
    };
    if (body.persistMemory && result.memoryUpdate) {
      const lobsterId = body.lobsterId || result.lobsterId || role;
      const persisted = lobster.persistLobsterMemory(lobsterId, result.memoryUpdate, body.memoryOptions || {});
      payload.memoryReceipt = {
        ok: persisted.ok,
        factCount: persisted.factCount,
        rawDialogueStored: false
      };
    }
    return sendJson(res, 200, payload);
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: 'lobster_message_failed',
      message: error && error.message ? error.message : 'unknown_error'
    });
  }
}
