import { clean, clientRateKey, json, rateLimit, readJson, sessionSecret, verifySession } from '../mini-shared.js';
import { configured, insertRows, nowIso, safeId, scrub, selectRows, serviceContract } from '../mini-store.js';

const PLANS = [
  { plan_id: 'trial_7d', name: '7 天体验', price_cents: 0, report_quota: 1, ai_quota: 30, upload_quota: 3 },
  { plan_id: 'family_month', name: '家庭月度陪伴', price_cents: 9900, report_quota: 4, ai_quota: 300, upload_quota: 30 }
];

async function auth(req) {
  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || '', sessionSecret(env));
  return session;
}

export async function plans(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const limited = rateLimit(clientRateKey(req, 'mini:billing-plans'), 180);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);
  return json({ ok: true, plans: PLANS, service_contract: serviceContract('mini_billing_plans'), engine_version: 'mini-billing-plans-v1' });
}

export async function quota(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const session = await auth(req);
  if (!session.ok) return json({ ok: false, error: 'bad_session' }, 401);
  let quotaState = { plan_id: 'trial_7d', ai_remaining: 30, report_remaining: 1, upload_remaining: 3 };
  let persisted = false;
  if (configured() && session.payload?.user_id) {
    const result = await selectRows('mini_billing_quotas', `?user_id=eq.${encodeURIComponent(session.payload.user_id)}&select=plan_id,ai_remaining,report_remaining,upload_remaining,updated_at&limit=1`);
    if (result.ok && Array.isArray(result.data) && result.data[0]) {
      quotaState = result.data[0];
      persisted = true;
    }
  }
  return json({ ok: true, service_ready: configured(), persisted, quota: quotaState, service_contract: serviceContract('mini_billing_quotas'), engine_version: 'mini-billing-quota-v1' });
}

export async function order(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const limited = rateLimit(clientRateKey(req, 'mini:billing-order'), 40);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);
  const session = await auth(req);
  if (!session.ok) return json({ ok: false, error: 'bad_session' }, 401);
  let body = {};
  try {
    body = await readJson(req, 8 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }
  const plan = PLANS.find((item) => item.plan_id === clean(body.plan_id || '', 60));
  if (!plan) return json({ ok: false, error: 'bad_plan' }, 400);
  const orderId = safeId('order');
  const row = {
    order_id: orderId,
    user_id: clean(session.payload?.user_id || '', 100) || null,
    plan_id: plan.plan_id,
    amount_cents: plan.price_cents,
    status: plan.price_cents ? 'pending_pay' : 'trial_activated',
    payload: scrub({ source: body.source || '', client_order_id: body.client_order_id || '' }),
    created_at: nowIso(),
    updated_at: nowIso()
  };
  const stored = await insertRows('mini_billing_orders', row, 'return=representation');
  const envObj = (typeof process !== 'undefined' && process.env) || {};
  return json({
    ok: true,
    order_id: orderId,
    persisted: Boolean(stored.ok),
    payment_ready: Boolean(envObj.WECHAT_PAY_MCH_ID && envObj.WECHAT_PAY_PRIVATE_KEY),
    payment_params: null,
    status: row.status,
    action_required: plan.price_cents ? 'wechat_pay_configuration' : '',
    service_contract: serviceContract('mini_billing_orders'),
    persistence_warning: stored.ok ? '' : stored.error || '',
    engine_version: 'mini-billing-order-v1'
  });
}
