import { clean, clientRateKey, json, rateLimit, readJson, sessionSecret, verifySession } from '../mini-shared.js';
import { configured, nowIso, safeId, scrub, serviceContract, upsertRows } from '../mini-store.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:children'), 80);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || '', sessionSecret(env));
  if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);

  let body = {};
  try {
    body = await readJson(req, 16 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const payload = session.payload || {};
  const userId = clean(payload.user_id || body.user_id || '', 100) || safeId('user');
  const childId = clean(body.child_id || '', 100) || safeId('child');
  const displayName = clean(body.display_name || body.name || '孩子', 40) || '孩子';
  const row = {
    child_id: childId,
    user_id: userId,
    display_name: displayName,
    grade: clean(body.grade || '', 20) || null,
    school_stage: clean(body.school_stage || body.stage || '', 30) || null,
    status: clean(body.status || 'active', 20) || 'active',
    profile: scrub(body.profile || body),
    updated_at: nowIso()
  };
  const stored = await upsertRows('mini_children', row, 'child_id');

  return json({
    ok: true,
    service_ready: configured(),
    persisted: Boolean(stored.ok),
    child: {
      child_id: childId,
      display_name: displayName,
      grade: row.grade || '',
      school_stage: row.school_stage || '',
      status: row.status
    },
    service_contract: serviceContract('mini_children'),
    persistence_warning: stored.ok ? '' : stored.error || '',
    engine_version: 'mini-children-v1'
  });
}
