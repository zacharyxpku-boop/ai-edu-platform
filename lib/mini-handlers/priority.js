import { clean, clamp, clientRateKey, json, rateLimit, readJson } from '../mini-shared.js';

const AXES = [
  { key: 'concept', name: 'concept understanding' },
  { key: 'calculation', name: 'calculation accuracy' },
  { key: 'reading', name: 'problem reading' },
  { key: 'transfer', name: 'transfer practice' },
  { key: 'expression', name: 'solution expression' },
  { key: 'load', name: 'homework load' }
];

function splitTasks(text) {
  return String(text || '')
    .split(/\r?\n|;|,/)
    .map((item) => clean(item, 160))
    .filter(Boolean)
    .slice(0, 12);
}

function scoreTask(task, index) {
  let score = 55 - index * 2;
  if (/wrong|mistake|review|application|word problem|model|proof|explain|错|应用|复盘|审题|表达/.test(task)) score += 24;
  if (/copy|optional|preview|抄|选做|预习/.test(task)) score -= 18;
  return clamp(score, 20, 95, 55);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: 'POST only' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:priority'), 120);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 24 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const total = clamp(body.totalScore || 100, 1, 1000, 100);
  const score = clamp(body.score == null ? 70 : body.score, 0, total, 70);
  const base = Math.round((score / total) * 100);
  const tasks = splitTasks(body.homeworkText || body.examText || 'core homework\nreview one wrong question\none short transfer check');
  const items = tasks.map((task, index) => {
    const value = scoreTask(task, index);
    return {
      id: `hw_${index + 1}`,
      text: task,
      score: value,
      minutes: Math.max(5, Math.round((Number(body.minutes || 35) || 35) / Math.max(3, tasks.length))),
      reason: value >= 70 ? 'hits current learning evidence' : value < 45 ? 'lower value tonight' : 'use if energy allows',
      evidence: {
        tags: value >= 70 ? ['priority'] : ['flexible'],
        decision: value >= 70 ? 'must_do' : value < 45 ? 'can_skip' : 'flexible',
        calibration_key: `local:${index + 1}`
      }
    };
  }).sort((a, b) => b.score - a.score);

  const mustCount = Math.max(1, Math.ceil(items.length * 0.45));
  const skipCount = Math.max(1, Math.floor(items.length * 0.2));
  const mustDo = items.slice(0, mustCount);
  const canSkip = items.slice(Math.max(mustCount, items.length - skipCount));
  const flexible = items.slice(mustCount, Math.max(mustCount, items.length - skipCount));

  const axes = AXES.map((axis, index) => ({
    key: axis.key,
    name: axis.name,
    score: clamp(base - index * 4, 18, 94, base),
    evidence: 'local priority estimate, confirm with real homework evidence'
  }));

  return json({
    ok: true,
    source: 'local_priority_rules',
    persisted: false,
    service_contract: {
      mode: 'local_rules',
      evidence_required: ['score_or_exam_text', 'homework_text', 'family_confirmation'],
      action_required: 'account_service_configuration'
    },
    grade: clean(body.grade || 'grade', 20),
    subject: clean(body.subject || 'math', 20),
    score,
    total_score: total,
    axes,
    weak_points: axes.slice().sort((a, b) => a.score - b.score).slice(0, 3),
    homework_plan: {
      must_do: mustDo,
      flexible,
      can_skip: canSkip,
      summary: {
        must_minutes: mustDo.reduce((sum, item) => sum + item.minutes, 0),
        saved_minutes: canSkip.reduce((sum, item) => sum + item.minutes, 0),
        top_reason: mustDo[0]?.reason || 'start with the clearest evidence'
      }
    },
    ai_notice: 'AI assisted draft for learning decisions; confirm with real homework evidence.',
    engine_version: 'mini-priority-v1.3',
    updated_at: new Date().toISOString()
  });
}
