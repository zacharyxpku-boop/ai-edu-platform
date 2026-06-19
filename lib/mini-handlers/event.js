import {
  clean,
  clientRateKey,
  json,
  rateLimit,
  readJson,
  sessionSecret,
  verifySession
} from '../mini-shared.js';
import { configured, insertRows, nowIso, safeId, scrub, serviceContract } from '../mini-store.js';

const ALLOWED_EVENTS = new Set([
  'learning_event',
  'learning_action_started',
  'module_viewed',
  'module_started',
  'module_completed',
  'module_review_pack_imported',
  'tutor_message_sent',
  'tutor_mastery_ready',
  'tutor_blocked_answer_request',
  'tutor_blocked',
  'tutor_progress',
  'material_started',
  'factory_generated',
  'review_started',
  'review_completed',
  'revisit_started',
  'revisit_attempt',
  'revisit_completed',
  'report_viewed',
  'child_profile_updated'
]);

function normalizeEvent(body = {}, session = {}, sessionId = '') {
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : body;
  const rawEvent = clean(body.event || body.event_name || body.kind || '', 80);
  const eventName = ALLOWED_EVENTS.has(rawEvent) ? rawEvent : 'learning_event';
  return {
    event_id: clean(body.id || body.event_id || body.mutation_id || '', 120) || safeId('evt'),
    session_id: clean(body.session_id || sessionId || '', 2048) || null,
    user_id: clean(session.payload?.user_id || body.user_id || '', 100) || null,
    child_id: clean(body.child_id || body.student_id || session.payload?.child_id || payload.child_id || '', 100) || null,
    client_id: clean(body.client_id || body.clientId || '', 120) || null,
    event_name: eventName,
    page: clean(body.page || payload.page || '', 80) || null,
    source: clean(body.source || payload.source || payload.type || '', 80) || null,
    entity_type: clean(body.entity_type || payload.entity_type || '', 60) || null,
    entity_id: clean(body.entity_id || payload.entity_id || payload.card_id || payload.module_id || payload.id || '', 120) || null,
    payload: scrub(payload),
    event_created_at: clean(body.created_at || payload.created_at || '', 40) || nowIso(),
    received_at: nowIso()
  };
}

function funnelHint(eventName) {
  if (eventName.startsWith('tutor_')) return 'tutor_to_practice_loop';
  if (eventName.startsWith('review_') || eventName.startsWith('revisit_')) return 'spaced_review_loop';
  if (eventName.startsWith('module_') || eventName === 'learning_action_started') return 'material_to_report_loop';
  if (eventName.startsWith('report_')) return 'parent_report_loop';
  return 'learning_evidence';
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST 请求' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:event'), 600);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  const env = (typeof process !== 'undefined' && process.env) || {};
  const sessionHeader = req.headers.get('x-mini-session') || '';
  const session = sessionHeader
    ? await verifySession(sessionHeader, sessionSecret(env))
    : { ok: true, mode: 'anonymous', payload: {} };
  if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);

  let body = {};
  try {
    body = await readJson(req, 24 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const event = normalizeEvent(body, session, sessionHeader);
  const stored = await insertRows('mini_learning_events', event, 'resolution=merge-duplicates,return=representation');
  return json({
    ok: true,
    event_id: event.event_id,
    received_at: event.received_at,
    source: stored.ok ? 'supabase' : 'local_receipt',
    mode: stored.ok ? 'supabase' : 'local_receipt',
    persisted: Boolean(stored.ok),
    action_required: stored.ok ? '' : 'event_storage_configuration',
    event,
    funnel: funnelHint(event.event_name),
    service_contract: serviceContract('mini_learning_events'),
    persistence_warning: stored.ok ? '' : stored.error || '',
    engine_version: 'mini-event-dispatch-v2'
  });
}
