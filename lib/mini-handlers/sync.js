import {
  clean,
  clientRateKey,
  json,
  rateLimit,
  readJson,
  sessionSecret,
  verifySession
} from '../mini-shared.js';
import { configured, insertRows, nowIso, safeId, scrub, serviceContract } from '../mini-store.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:sync'), 160);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 96 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const mutations = Array.isArray(body.mutations) ? body.mutations.slice(0, 120) : [];
  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || body.session_id || '', sessionSecret(env));
  if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);

  const rows = mutations.map((item, index) => ({
    mutation_id: clean(item.id || item.mutation_id || '', 120) || safeId('mut'),
    session_id: clean(body.session_id || req.headers.get('x-mini-session') || '', 2048) || null,
    user_id: clean(session.payload?.user_id || body.user_id || '', 100) || null,
    child_id: clean(item.child_id || item.student_id || body.child_id || session.payload?.child_id || '', 100) || null,
    kind: clean(item.kind || item.type || 'learning_event', 80) || 'learning_event',
    payload: scrub(item.payload || item),
    client_order: index,
    created_at: nowIso()
  }));
  const stored = rows.length ? await insertRows('mini_sync_mutations', rows, 'resolution=merge-duplicates,return=representation') : { ok: true };
  const acknowledged = mutations.map((item, index) => item.id || item.mutation_id || `local_${index + 1}`);
  return json({
    ok: true,
    pushed: stored.ok ? mutations.length : 0,
    pending: stored.ok ? 0 : mutations.length,
    cursor: `sync_${Date.now()}`,
    mode: stored.ok ? (mutations.length ? 'supabase' : 'empty') : 'local_receipt',
    service_ready: configured(),
    persisted: Boolean(stored.ok && rows.length),
    action_required: stored.ok ? '' : 'sync_storage_configuration',
    acknowledged,
    service_contract: serviceContract('mini_sync_mutations'),
    persistence_warning: stored.ok ? '' : stored.error || '',
    engine_version: 'mini-sync-dispatch-v2'
  });
}
