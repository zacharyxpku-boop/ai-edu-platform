import { clean, clientRateKey, json, rateLimit, sessionSecret, verifySession } from '../mini-shared.js';
import { configured, selectRows, serviceContract } from '../mini-store.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:student-timeline'), 180);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || '', sessionSecret(env));
  if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);

  const url = new URL(req.url || 'https://yuandianzhixue.com/api/mini/student/timeline');
  const pathId = (url.pathname.match(/^\/api\/mini\/student\/([^/]+)\/timeline$/) || [])[1] || '';
  const studentId = clean(url.searchParams.get('id') || url.searchParams.get('student_id') || pathId || session.payload?.child_id || '', 100);
  if (!studentId) return json({ ok: false, error: 'missing_student_id' }, 400);

  let items = [];
  let persisted = false;
  let warning = '';
  if (configured()) {
    const query = `?child_id=eq.${encodeURIComponent(studentId)}&select=event_id,event_name,page,source,entity_type,entity_id,payload,received_at&order=received_at.desc&limit=50`;
    const result = await selectRows('mini_learning_events', query);
    if (result.ok && Array.isArray(result.data)) {
      persisted = true;
      items = result.data.map((item) => ({
        id: item.event_id,
        type: item.event_name,
        title: item.payload?.title || item.entity_type || item.event_name,
        source: item.source || '',
        entity_id: item.entity_id || '',
        occurred_at: item.received_at
      }));
    } else {
      warning = result.error || '';
    }
  }

  return json({
    ok: true,
    service_ready: configured(),
    persisted,
    student_id: studentId,
    timeline: items,
    empty_state: items.length ? '' : '还没有足够的学习证据，先完成一次 AI 私教追问或一局练习。',
    service_contract: serviceContract('mini_learning_events'),
    persistence_warning: warning,
    engine_version: 'mini-student-timeline-v1'
  });
}
