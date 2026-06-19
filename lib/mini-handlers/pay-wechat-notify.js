import { clean, clientRateKey, json, rateLimit, readJson } from '../mini-shared.js';
import { configured, insertRows, nowIso, safeId, scrub, serviceContract } from '../mini-store.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'pay:wechat-notify'), 240);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 64 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const signature = clean(req.headers.get('wechatpay-signature') || '', 500);
  const serial = clean(req.headers.get('wechatpay-serial') || '', 120);
  const envObj = (typeof process !== 'undefined' && process.env) || {};
  const verified = Boolean(envObj.WECHAT_PAY_PLATFORM_CERT && signature && serial);
  if (!verified) {
    return json({
      ok: false,
      error: 'wechat_pay_verify_not_configured',
      message: '微信支付回调必须先配置平台证书并完成验签，不能直接信任前端或回调内容。',
      service_contract: serviceContract('mini_payment_notifications')
    }, 503);
  }

  const notifyId = safeId('paynotify');
  const stored = await insertRows('mini_payment_notifications', {
    notify_id: notifyId,
    provider: 'wechat_pay',
    serial,
    verified: true,
    payload: scrub(body),
    created_at: nowIso()
  }, 'return=representation');

  return json({
    ok: true,
    notify_id: notifyId,
    persisted: Boolean(stored.ok),
    service_ready: configured(),
    service_contract: serviceContract('mini_payment_notifications'),
    persistence_warning: stored.ok ? '' : stored.error || '',
    engine_version: 'mini-wechat-pay-notify-v1'
  });
}
