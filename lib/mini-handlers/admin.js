import { clean, clientRateKey, json, rateLimit, readJson } from '../mini-shared.js';
import { configured, insertRows, nowIso, requireAdmin, safeId, scrub, selectRows, serviceContract, upsertRows } from '../mini-store.js';

async function listTable(req, scope, table, query) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const limited = rateLimit(clientRateKey(req, `admin:${scope}`), 600);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);
  const admin = requireAdmin(req);
  if (!admin.ok) return json({ ok: false, error: admin.error }, admin.status);
  const result = await selectRows(table, query);
  return json({
    ok: true,
    service_ready: configured(),
    persisted: Boolean(result.ok),
    items: result.ok && Array.isArray(result.data) ? result.data : [],
    service_contract: serviceContract(table),
    persistence_warning: result.ok ? '' : result.error || '',
    engine_version: `mini-admin-${scope}-v1`
  });
}

export function users(req) {
  return listTable(req, 'users', 'mini_users', '?select=user_id,nickname,active_role,created_at,updated_at&order=updated_at.desc&limit=100');
}

export function reports(req) {
  return listTable(req, 'reports', 'mini_report_jobs', '?select=job_id,user_id,child_id,status,source,updated_at&order=updated_at.desc&limit=100');
}

export function conversations(req) {
  return listTable(req, 'conversations', 'mini_ai_traces', '?select=trace_id,user_id,child_id,endpoint,risk_type,blocked,provider,created_at&order=created_at.desc&limit=100');
}

export function aiTraces(req) {
  return conversations(req);
}

export async function featureFlags(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (!['GET', 'POST'].includes(req.method)) return json({ ok: false, error: 'method_not_allowed' }, 405);
  const admin = requireAdmin(req);
  if (!admin.ok) return json({ ok: false, error: admin.error }, admin.status);
  if (req.method === 'GET') {
    const result = await selectRows('mini_feature_flags', '?select=flag_key,enabled,config,updated_at&order=flag_key.asc&limit=200');
    return json({ ok: true, items: result.ok ? result.data || [] : [], service_contract: serviceContract('mini_feature_flags'), persistence_warning: result.ok ? '' : result.error || '' });
  }
  let body = {};
  try {
    body = await readJson(req, 16 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }
  const flagKey = clean(body.flag_key || body.key || '', 80);
  if (!flagKey) return json({ ok: false, error: 'missing_flag_key' }, 400);
  const stored = await upsertRows('mini_feature_flags', {
    flag_key: flagKey,
    enabled: Boolean(body.enabled),
    config: scrub(body.config || {}),
    updated_at: nowIso()
  }, 'flag_key');
  return json({ ok: true, flag_key: flagKey, persisted: Boolean(stored.ok), service_contract: serviceContract('mini_feature_flags'), persistence_warning: stored.ok ? '' : stored.error || '' });
}

export async function qbankItems(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const admin = requireAdmin(req);
  if (!admin.ok) return json({ ok: false, error: admin.error }, admin.status);
  let body = {};
  try {
    body = await readJson(req, 64 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }
  const itemId = clean(body.item_id || '', 100) || safeId('qitem');
  const stored = await insertRows('mini_qbank_items', {
    item_id: itemId,
    subject: clean(body.subject || '数学', 30),
    grade: clean(body.grade || '', 20) || null,
    knowledge_id: clean(body.knowledge_id || '', 100) || null,
    item_type: clean(body.item_type || 'practice', 40),
    prompt_summary: clean(body.prompt_summary || body.title || '', 240),
    source: clean(body.source || 'admin_cms', 80),
    review_status: 'pending_review',
    payload: scrub(body.payload || body),
    created_at: nowIso(),
    updated_at: nowIso()
  }, 'return=representation');
  return json({ ok: true, item_id: itemId, persisted: Boolean(stored.ok), review_status: 'pending_review', service_contract: serviceContract('mini_qbank_items'), persistence_warning: stored.ok ? '' : stored.error || '' });
}
