import { clean, clientRateKey, json, rateLimit, readJson } from '../mini-shared.js';

function makeCard(text, index, type) {
  const base = clean(text || 'learning evidence', 120) || 'learning evidence';
  const id = `${type}_${index + 1}_${Math.random().toString(36).slice(2, 7)}`;
  const prompts = {
    concept: ['What is the key idea?', base],
    step: ['What is the first step?', 'State the first step and stop before the full answer.'],
    trap: ['What should be checked before solving?', 'Check conditions, units, and the stuck step.'],
    cloze: [`${base.slice(0, 24)} ____`, 'Fill the missing key point from the source material.']
  };
  const pair = prompts[type] || prompts.concept;
  return {
    id,
    cardType: type,
    question: pair[0],
    answer: pair[1],
    reason: 'local evidence card',
    context: base,
    quality: 72,
    engine: 'mini-content-engine-dispatch-v1'
  };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:content-engine'), 100);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 32 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const text = clean(body.text || body.rawText || body.content || '', 5000);
  const lines = text ? text.split(/\r?\n|;|,/).map((line) => clean(line, 160)).filter(Boolean).slice(0, 8) : [];
  const source = lines.length ? lines : ['local learning material'];
  const types = ['concept', 'step', 'trap', 'cloze'];
  const cards = source.flatMap((line, index) => types.map((type) => makeCard(line, index, type))).slice(0, 32);

  return json({
    ok: true,
    provider: 'local_rules',
    persisted: false,
    service_contract: {
      mode: 'local_rules',
      evidence_required: ['text'],
      action_required: 'model_service_configuration'
    },
    cards,
    count: cards.length,
    coveredTypes: types,
    quality_gate: {
      title: 'Material import gate',
      score: lines.length ? 80 : 45,
      label: lines.length ? 'ready_for_local_review' : 'needs_real_material',
      next: 'Use the cards for short revisit and parent evidence review.'
    },
    study_pack: {
      title: 'Knowledge cards',
      summary: 'material -> cards -> short quiz -> revisit evidence'
    },
    engine_version: 'mini-content-engine-dispatch-v1'
  });
}
