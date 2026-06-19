import { clean, clientRateKey, json, rateLimit, sessionSecret, verifySession } from '../mini-shared.js';
import { configured, selectRows, serviceContract } from '../mini-store.js';

const FALLBACK_MAP = [
  { id: 'math.number.decimal', subject: '数学', grade_band: '3-5', title: '小数意义与位值', parent_id: '', status: 'active' },
  { id: 'math.number.fraction', subject: '数学', grade_band: '3-5', title: '分数初步认识', parent_id: '', status: 'active' },
  { id: 'math.geometry.area', subject: '数学', grade_band: '3-5', title: '面积与周长', parent_id: '', status: 'active' },
  { id: 'math.word-problem.first-step', subject: '数学', grade_band: '3-6', title: '应用题第一步', parent_id: '', status: 'active' }
];

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:knowledge-map'), 180);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || '', sessionSecret(env));
  if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);

  const url = new URL(req.url || 'https://yuandianzhixue.com/api/mini/knowledge-map');
  const subject = clean(url.searchParams.get('subject') || '', 30);
  const grade = clean(url.searchParams.get('grade') || session.payload?.grade || '', 20);

  let nodes = FALLBACK_MAP.filter((item) => !subject || item.subject === subject);
  let persisted = false;
  let warning = '';
  if (configured()) {
    const filters = [`select=knowledge_id,subject,grade_band,title,parent_id,status`, 'status=eq.active', 'limit=200'];
    if (subject) filters.push(`subject=eq.${encodeURIComponent(subject)}`);
    const result = await selectRows('mini_knowledge_nodes', `?${filters.join('&')}`);
    if (result.ok && Array.isArray(result.data) && result.data.length) {
      nodes = result.data.map((item) => ({
        id: item.knowledge_id,
        subject: item.subject,
        grade_band: item.grade_band,
        title: item.title,
        parent_id: item.parent_id || '',
        status: item.status
      }));
      persisted = true;
    } else if (!result.ok) {
      warning = result.error || '';
    }
  }

  return json({
    ok: true,
    service_ready: configured(),
    persisted,
    subject: subject || '全部',
    grade,
    nodes,
    current_focus: nodes[0] || null,
    service_contract: serviceContract('mini_knowledge_nodes'),
    persistence_warning: warning,
    engine_version: 'mini-knowledge-map-v1'
  });
}
