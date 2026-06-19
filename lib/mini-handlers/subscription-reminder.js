import { clean, clientRateKey, json, rateLimit, readJson, sessionSecret, verifySession } from '../mini-shared.js';
import { configured, insertRows, nowIso, safeId, scrub, serviceContract } from '../mini-store.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:subscription-reminder'), 80);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || '', sessionSecret(env));
  if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);

  let body = {};
  try {
    body = await readJson(req, 12 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const reminderId = safeId('reminder');
  const row = {
    reminder_id: reminderId,
    user_id: clean(session.payload?.user_id || '', 100) || null,
    child_id: clean(body.child_id || body.student_id || session.payload?.child_id || '', 100) || null,
    template_key: clean(body.template_key || body.scene || 'review_today', 60),
    target_time: clean(body.target_time || body.send_at || '', 60) || null,
    status: 'queued',
    payload: scrub(body.payload || body),
    created_at: nowIso()
  };
  const stored = await insertRows('mini_subscription_reminders', row, 'return=representation');

  return json({
    ok: true,
    reminder_id: reminderId,
    service_ready: configured() && Boolean(env.WECHAT_SUBSCRIBE_TEMPLATE_ID || env.MINIAPP_SUBSCRIBE_TEMPLATE_ID),
    persisted: Boolean(stored.ok),
    status: stored.ok ? 'queued' : 'local_receipt',
    action_required: stored.ok ? 'wechat_subscription_sender_configuration' : 'reminder_storage_configuration',
    service_contract: serviceContract('mini_subscription_reminders'),
    persistence_warning: stored.ok ? '' : stored.error || '',
    engine_version: 'mini-subscription-reminder-v1'
  });
}
