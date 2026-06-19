import {
  clean,
  clientRateKey,
  json,
  rateLimit,
  readJson,
  riskyContent,
  sessionSecret,
  verifySession
} from '../mini-shared.js';
import { configured, insertRows, nowIso, safeId, scrub, serviceContract } from '../mini-store.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: 'POST only' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:content'), 180);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 8 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const content = clean(body.content || body.message || '', 1500);
  if (!content) return json({ ok: false, error: 'missing_content', message: 'content required' }, 400);
  const result = riskyContent(content);
  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || '', sessionSecret(env));
  const trace = {
    trace_id: safeId('trace'),
    session_id: clean(req.headers.get('x-mini-session') || '', 180) || null,
    user_id: session.ok ? clean(session.payload?.user_id || '', 100) || null : null,
    child_id: session.ok ? clean(session.payload?.child_id || body.child_id || '', 100) || null : clean(body.child_id || '', 100) || null,
    endpoint: 'content-check',
    risk_type: result.type,
    input_summary: clean(content, 220),
    output_summary: result.safe ? 'allow' : 'block_or_redirect',
    blocked: !result.safe,
    sanitized: scrub({ keyword: result.keyword || '' }),
    provider: 'local_safety_rules',
    created_at: nowIso()
  };
  const stored = await insertRows('mini_ai_traces', trace, 'return=minimal');
  return json({
    ok: true,
    provider: 'local_safety_rules',
    persisted: Boolean(stored.ok),
    service_contract: {
      ...serviceContract('mini_ai_traces'),
      mode: 'local_rules',
      evidence_required: ['content'],
      action_required: stored.ok ? '' : 'wechat_msg_sec_check_or_trace_storage_configuration'
    },
    safe: result.safe,
    risk_type: result.type,
    keyword: result.keyword || '',
    next_step: result.safe ? 'allow' : 'block_or_redirect',
    trace_id: trace.trace_id,
    persistence_warning: stored.ok ? '' : stored.error || '',
    engine_version: 'mini-content-check-v1.2'
  });
}
