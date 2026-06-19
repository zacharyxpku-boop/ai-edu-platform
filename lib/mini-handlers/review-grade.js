import { clean, clientRateKey, json, rateLimit, readJson } from '../mini-shared.js';

function normalizeGrade(value) {
  const text = clean(value || '', 20);
  if (['again', 'forgotten', 'hard'].includes(text)) return text === 'hard' ? 'fuzzy' : 'forgotten';
  if (['fuzzy', 'easy', 'remembered'].includes(text)) return text;
  return 'remembered';
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:review-grade'), 500);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 32 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const card = body.card || {};
  const grade = normalizeGrade(body.grade || body.rating);
  const delta = grade === 'forgotten' ? 1 : grade === 'fuzzy' ? 2 : grade === 'easy' ? 4 : 3;
  const total = Number(body.profile?.xp || body.xp || 0) + delta;
  return json({
    ok: true,
    persisted: false,
    service_contract: {
      mode: 'request_card_only',
      evidence_required: ['card_id', 'grade'],
      action_required: 'account_service_configuration'
    },
    card_id: card.id || body.card_id || '',
    grade,
    schedule: {
      next_review: new Date(Date.now() + delta * 86400000).toISOString(),
      interval_days: delta
    },
    learning_record_delta: delta,
    learning_record_total: total,
    progress_band: total >= 40 ? 'building' : 'starting',
    learning_record_stage: total >= 40 ? 'habit_building' : 'first_records',
    event: {
      card_id: card.id || body.card_id || '',
      rating: grade,
      learning_record_delta: delta,
      created_at: new Date().toISOString()
    },
    engine_version: 'mini-review-grade-dispatch-v1'
  });
}
