import { clientRateKey, json, rateLimit, readJson } from '../mini-shared.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:quiz-submit'), 300);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 64 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const answers = Array.isArray(body.answers) ? body.answers.slice(0, 50) : [];
  const correct = answers.filter((item) => !!item.correct).length;
  const total = answers.length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const delta = correct * 2;
  return json({
    ok: true,
    persisted: false,
    service_contract: {
      mode: 'request_attempt_only',
      evidence_required: ['answers.correct', 'card_id'],
      action_required: 'account_service_configuration'
    },
    attempt_id: body.attempt_id || `quiz_${Date.now()}`,
    total,
    correct,
    accuracy,
    learning_record_delta: delta,
    should_repair_wrong_cause: total > 0 && accuracy < 70,
    event: {
      kind: 'quiz_attempt',
      total,
      correct,
      accuracy,
      learning_record_delta: delta,
      created_at: new Date().toISOString()
    },
    engine_version: 'mini-quiz-submit-dispatch-v1'
  });
}
