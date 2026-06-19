import { clean, clientRateKey, json, rateLimit, readJson, sessionSecret, verifySession } from '../mini-shared.js';
import { configured, nowIso, safeId, serviceContract, upsertRows } from '../mini-store.js';

const ROLES = new Set(['student', 'parent', 'teacher']);

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:role-switch'), 120);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || '', sessionSecret(env));
  if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);

  let body = {};
  try {
    body = await readJson(req, 8 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const role = clean(body.role || '', 20);
  if (!ROLES.has(role)) return json({ ok: false, error: 'bad_role', allowed_roles: Array.from(ROLES) }, 400);

  const userId = clean(session.payload?.user_id || '', 100);
  const childId = clean(body.child_id || session.payload?.child_id || '', 100);
  const row = {
    switch_id: safeId('role'),
    user_id: userId || null,
    role,
    child_id: childId || null,
    created_at: nowIso()
  };
  const stored = await upsertRows('mini_role_switches', row, 'switch_id');

  return json({
    ok: true,
    service_ready: configured(),
    persisted: Boolean(stored.ok),
    current_role: role,
    child_id: childId,
    permissions: {
      can_view_report: ['parent', 'teacher'].includes(role),
      can_practice: ['student', 'parent'].includes(role),
      can_view_class: role === 'teacher'
    },
    service_contract: serviceContract('mini_role_switches'),
    persistence_warning: stored.ok ? '' : stored.error || '',
    engine_version: 'mini-role-switch-v1'
  });
}
