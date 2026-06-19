import { clean, clientRateKey, json, rateLimit, readJson, sessionSecret, verifySession } from '../mini-shared.js';
import { insertRows, nowIso, safeId, scrub, serviceContract } from '../mini-store.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (!['GET', 'POST'].includes(req.method)) return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:report'), 180);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  if (req.method === 'POST') {
    try {
      body = await readJson(req, 64 * 1024);
    } catch (error) {
      return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
    }
  }

  const events = Array.isArray(body.events) ? body.events : [];
  const cards = Array.isArray(body.cards) ? body.cards : [];
  const reviewed = events.filter((item) => item && item.rating);
  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || body.session_id || '', sessionSecret(env));
  const jobId = clean(body.job_id || '', 120) || safeId('report');
  const summary = {
    reviewed_cards: reviewed.length,
    due_cards: cards.length,
    progress_band: reviewed.length ? 'building' : 'starting',
    parent_summary: reviewed.length
      ? `已沉淀 ${reviewed.length} 条学习记录。下一步先核对一个错因。`
      : '学习证据还不够，先完成一次短练习或一次 AI 私教追问。'
  };
  const stored = req.method === 'POST'
    ? await insertRows('mini_report_jobs', {
      job_id: jobId,
      session_id: clean(req.headers.get('x-mini-session') || body.session_id || '', 180) || null,
      user_id: session.ok ? clean(session.payload?.user_id || '', 100) || null : null,
      child_id: clean(body.child_id || body.student_id || session.payload?.child_id || '', 100) || null,
      status: 'draft_ready',
      source: 'mini-report',
      input: scrub({ events_count: events.length, cards_count: cards.length, material_ids: body.material_ids || [] }),
      result: scrub(summary),
      error_code: null,
      created_at: nowIso(),
      updated_at: nowIso()
    }, 'resolution=merge-duplicates,return=representation')
    : { ok: false, error: 'get_status_uses_report_job_status' };
  return json({
    ok: true,
    source: 'local_learning_summary',
    persisted: Boolean(stored.ok),
    job_id: jobId,
    service_contract: {
      ...serviceContract('mini_report_jobs'),
      mode: 'request_records_only',
      evidence_required: ['review_events', 'review_cards', 'profile_stats'],
      action_required: stored.ok ? '' : 'report_storage_configuration'
    },
    weekly: summary,
    knowledge_gap: [],
    display_notice: '报告只使用已提交的学习证据，不做排名刺激，不承诺提分。',
    persistence_warning: stored.ok ? '' : stored.error || '',
    engine_version: 'mini-report-dispatch-v2'
  });
}
