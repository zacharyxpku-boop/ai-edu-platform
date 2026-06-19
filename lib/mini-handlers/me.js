import { clean, clientRateKey, json, rateLimit, sessionSecret, verifySession } from '../mini-shared.js';
import { configured, selectRows, serviceContract } from '../mini-store.js';

async function readSession(req) {
  const env = (typeof process !== 'undefined' && process.env) || {};
  const sessionId = req.headers.get('x-mini-session') || '';
  const session = await verifySession(sessionId, sessionSecret(env));
  return { sessionId, session };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:me'), 180);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  const { session } = await readSession(req);
  if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);

  const payload = session.payload || {};
  const userId = clean(payload.user_id || '', 100);
  let children = [];
  let persisted = false;
  if (configured() && userId) {
    const query = `?user_id=eq.${encodeURIComponent(userId)}&select=child_id,display_name,grade,school_stage,status,updated_at&order=updated_at.desc&limit=20`;
    const result = await selectRows('mini_children', query);
    if (result.ok && Array.isArray(result.data)) {
      children = result.data;
      persisted = true;
    }
  }

  return json({
    ok: true,
    mode: session.mode || 'signed',
    service_ready: configured(),
    persisted,
    user: {
      user_id: userId,
      active_role: clean(payload.role || 'parent', 20) || 'parent',
      active_child_id: clean(payload.child_id || '', 100)
    },
    roles: ['student', 'parent', 'teacher'],
    children,
    permissions: {
      can_view_report: ['parent', 'teacher'].includes(payload.role || 'parent'),
      can_practice: ['student', 'parent'].includes(payload.role || 'parent'),
      can_view_class: payload.role === 'teacher'
    },
    service_contract: serviceContract('mini_users'),
    engine_version: 'mini-me-v1'
  });
}
