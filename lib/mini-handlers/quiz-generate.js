import { clientRateKey, json, rateLimit, readJson } from '../mini-shared.js';

function questionFromCard(card, index) {
  const q = String(card?.question || card?.q || '').trim();
  const a = String(card?.answer || card?.a || '').trim();
  return {
    id: card?.id || `quiz_${index + 1}`,
    type: 'first_step',
    question: q ? `${q} What is the first step?` : 'What is the first step?',
    answer: a || 'State the first step and stop before the full answer.',
    source_card_id: card?.id || ''
  };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: 'POST only' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:quiz-generate'), 180);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 64 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const cards = Array.isArray(body.cards) ? body.cards : [];
  const limit = Math.max(1, Math.min(12, Number(body.limit || 6)));
  const questions = cards
    .filter((card) => card && (card.question || card.q) && (card.answer || card.a))
    .slice(0, limit)
    .map(questionFromCard);

  return json({
    ok: true,
    persisted: false,
    service_contract: {
      mode: 'request_cards_only',
      evidence_required: ['cards.question', 'cards.answer'],
      action_required: 'account_service_configuration'
    },
    count: questions.length,
    questions,
    estimated_minutes: Math.max(1, Math.ceil(questions.length * 0.6)),
    source: questions.length ? 'real_cards' : 'empty',
    engine_version: 'mini-quiz-generate-v1.1'
  });
}
