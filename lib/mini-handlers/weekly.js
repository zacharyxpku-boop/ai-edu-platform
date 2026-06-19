import { clean, clientRateKey, json, rateLimit, readJson } from '../mini-shared.js';

function list(value, limit = 6) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: 'POST only' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:weekly'), 80);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 24 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const axes = list(body.axes, 8);
  const weakPoints = list(body.weak_points || body.weakPoints, 4);
  const plan = body.homework_plan || body.plan || {};
  const must = list(plan.must_do, 6);
  const flexible = list(plan.flexible, 6);
  const skip = list(plan.can_skip, 6);
  const weakest = weakPoints[0] || axes.slice().sort((a, b) => Number(a.score || 0) - Number(b.score || 0))[0] || null;

  return json({
    ok: true,
    source: 'local_weekly_rules',
    persisted: false,
    service_contract: {
      mode: 'local_rules',
      evidence_required: ['axes', 'weak_points', 'homework_plan'],
      action_required: 'account_service_configuration'
    },
    grade: clean(body.grade || 'grade', 20),
    subject: clean(body.subject || 'math', 20),
    headline: weakest ? `Focus first on ${clean(weakest.name || weakest.key || 'one weak point', 40)}.` : 'Review one clear learning evidence point first.',
    focus: must.slice(0, 3).map((item) => ({
      text: clean(item.text || '', 120),
      reason: clean(item.reason || '', 120),
      evidence: item.evidence || null
    })),
    load: {
      must_minutes: Number(plan.summary?.must_minutes || must.reduce((sum, item) => sum + Number(item.minutes || 0), 0)),
      saved_minutes: Number(plan.summary?.saved_minutes || skip.reduce((sum, item) => sum + Number(item.minutes || 0), 0)),
      advice: skip.length ? 'Keep lower-value tasks behind tonight.' : 'Close the session after the must-do work.'
    },
    parent_script: 'Ask what the first step was, what got stuck, and what evidence changed today.',
    next_actions: [
      must[0] ? `Start with: ${clean(must[0].text || '', 80)}` : 'Pick one must-do item.',
      flexible[0] ? `If energy remains: ${clean(flexible[0].text || '', 80)}` : 'If energy remains, review the mistake cause.',
      'Next review should look for completion, mistake cause, and one small transfer.'
    ],
    ai_notice: 'AI assisted draft for learning decisions; confirm with real homework evidence.',
    generated_at: new Date().toISOString(),
    engine_version: 'mini-weekly-v1.1'
  });
}
