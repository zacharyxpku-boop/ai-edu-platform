import { clean, clientRateKey, json, rateLimit, readJson } from '../mini-shared.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:lead'), 20);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 16 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const name = clean(body.name || '', 50);
  const phone = clean(body.phone || '', 20);
  return json({
    ok: true,
    lead_id: `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    lead_store: {
      mode: 'local_receipt',
      persisted: false,
      action_required: 'service_configuration'
    },
    service_ready: false,
    service_contract: {
      table: 'mini_leads',
      primary_keys: ['lead_id'],
      future_join_keys: ['share_code', 'client_id', 'student_id', 'utm_source']
    },
    received: {
      has_name: !!name,
      has_phone: !!phone,
      page: clean(body.page || '', 100)
    },
    time: new Date().toISOString()
  });
}
