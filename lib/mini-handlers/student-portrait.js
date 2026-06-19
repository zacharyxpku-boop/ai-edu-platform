import { clean, clientRateKey, json, rateLimit, sessionSecret, verifySession } from '../mini-shared.js';
import { configured, selectRows, serviceContract } from '../mini-store.js';

function summarize(events) {
  const counts = {};
  for (const item of events) counts[item.event_name] = (counts[item.event_name] || 0) + 1;
  const tutorEvidence = (counts.tutor_progress || 0) + (counts.tutor_mastery_ready || 0);
  const practiceEvidence = (counts.review_completed || 0) + (counts.revisit_completed || 0);
  const materialEvidence = (counts.material_started || 0) + (counts.module_review_pack_imported || 0);
  return {
    status: events.length ? 'building' : 'not_enough_evidence',
    summary: events.length
      ? '已开始沉淀学习证据，建议继续围绕当前卡点补一次追问和一局练习。'
      : '暂时不能给孩子贴固定标签，需要先收集材料、追问和练习记录。',
    evidence_counts: {
      tutor: tutorEvidence,
      practice: practiceEvidence,
      material: materialEvidence,
      total: events.length
    },
    next_action: tutorEvidence ? '去知识乐园完成一局同卡点练习。' : '先在 AI 私教里说清卡住的第一步。'
  };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:student-portrait'), 180);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || '', sessionSecret(env));
  if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);

  const url = new URL(req.url || 'https://yuandianzhixue.com/api/mini/student/portrait');
  const pathId = (url.pathname.match(/^\/api\/mini\/student\/([^/]+)\/portrait$/) || [])[1] || '';
  const studentId = clean(url.searchParams.get('id') || url.searchParams.get('student_id') || pathId || session.payload?.child_id || '', 100);
  if (!studentId) return json({ ok: false, error: 'missing_student_id' }, 400);

  let events = [];
  let warning = '';
  if (configured()) {
    const result = await selectRows(
      'mini_learning_events',
      `?child_id=eq.${encodeURIComponent(studentId)}&select=event_name,payload,received_at&order=received_at.desc&limit=120`
    );
    if (result.ok && Array.isArray(result.data)) events = result.data;
    else warning = result.error || '';
  }

  return json({
    ok: true,
    service_ready: configured(),
    persisted: configured() && !warning,
    student_id: studentId,
    portrait: summarize(events),
    safety_note: '画像只基于已确认材料和学习事件，不做天赋定论、不承诺提分。',
    service_contract: serviceContract('mini_student_portraits'),
    persistence_warning: warning,
    engine_version: 'mini-student-portrait-v1'
  });
}
