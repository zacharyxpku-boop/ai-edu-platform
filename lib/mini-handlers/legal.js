import { clean, clientRateKey, json, rateLimit, readJson, sessionSecret, verifySession } from '../mini-shared.js';
import { configured, hashShort, insertRows, nowIso, safeId, scrub, selectRows, serviceContract } from '../mini-store.js';

const PRIVACY = {
  version: '2026-06-19',
  title: '原点智学隐私与儿童个人信息规则',
  summary: [
    '前端不保存模型密钥、微信密钥、支付密钥或数据库连接串。',
    '正式学习档案只通过后端接口同步和读取。',
    '成长报告只基于已确认材料和学习事件，不做天赋定论、不承诺提分。',
    '用户可以申请导出或删除账号与学习数据。'
  ],
  contact: 'support@yuandianzhixue.com'
};

async function sessionOf(req) {
  const env = (typeof process !== 'undefined' && process.env) || {};
  return verifySession(req.headers.get('x-mini-session') || '', sessionSecret(env));
}

export async function privacy(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const limited = rateLimit(clientRateKey(req, 'mini:privacy'), 300);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);
  return json({ ok: true, privacy: PRIVACY, service_contract: serviceContract('mini_legal_requests'), engine_version: 'mini-privacy-v1' });
}

export async function deleteRequest(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const session = await sessionOf(req);
  if (!session.ok) return json({ ok: false, error: 'bad_session' }, 401);
  let body = {};
  try {
    body = await readJson(req, 12 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }
  const requestId = safeId('delete');
  const stored = await insertRows('mini_legal_requests', {
    request_id: requestId,
    user_id: clean(session.payload?.user_id || '', 100) || null,
    request_type: 'delete_account',
    status: 'pending_manual_review',
    contact_hash: await hashShort(body.contact || body.phone || ''),
    payload: scrub({ reason: body.reason || '', child_id: body.child_id || '' }),
    created_at: nowIso()
  }, 'return=representation');
  return json({
    ok: true,
    request_id: requestId,
    persisted: Boolean(stored.ok),
    status: 'pending_manual_review',
    service_contract: serviceContract('mini_legal_requests'),
    persistence_warning: stored.ok ? '' : stored.error || '',
    engine_version: 'mini-delete-request-v1'
  });
}

export async function dataExport(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const session = await sessionOf(req);
  if (!session.ok) return json({ ok: false, error: 'bad_session' }, 401);
  const userId = clean(session.payload?.user_id || '', 100);
  let events = [];
  if (configured() && userId) {
    const result = await selectRows('mini_learning_events', `?user_id=eq.${encodeURIComponent(userId)}&select=event_id,event_name,source,entity_type,entity_id,received_at&order=received_at.desc&limit=200`);
    if (result.ok && Array.isArray(result.data)) events = result.data;
  }
  const requestId = safeId('export');
  const stored = await insertRows('mini_legal_requests', {
    request_id: requestId,
    user_id: userId || null,
    request_type: 'data_export',
    status: 'ready_limited_export',
    payload: scrub({ event_count: events.length }),
    created_at: nowIso()
  }, 'return=representation');
  return json({
    ok: true,
    request_id: requestId,
    persisted: Boolean(stored.ok),
    export: { user_id: userId, events },
    service_contract: serviceContract('mini_legal_requests'),
    persistence_warning: stored.ok ? '' : stored.error || '',
    engine_version: 'mini-data-export-v1'
  });
}
