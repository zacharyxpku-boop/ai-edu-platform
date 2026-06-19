import {
  clean,
  clientRateKey,
  json,
  rateLimit,
  readJson,
  sessionSecret,
  verifySession
} from '../mini-shared.js';
import { configured, selectRows, serviceContract } from '../mini-store.js';

function progressBand(points) {
  if (points >= 120) return 'stable';
  if (points >= 40) return 'building';
  return 'starting';
}

function recordStage(points) {
  if (points >= 120) return 'evidence_collected';
  if (points >= 40) return 'habit_building';
  return 'first_records';
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: 'POST only' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:review-today'), 180);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 64 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const cards = Array.isArray(body.cards) ? body.cards : [];
  const events = Array.isArray(body.events) ? body.events : [];
  const profile = body.profile || {};
  const points = Number(profile.recordPoints || profile.xp || body.xp || 0);
  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || body.session_id || '', sessionSecret(env));
  const childId = clean(body.child_id || body.student_id || session.payload?.child_id || '', 100);
  let serverEvents = [];
  let serviceWarning = '';
  if (configured() && session.ok && childId) {
    const result = await selectRows(
      'mini_learning_events',
      `?child_id=eq.${encodeURIComponent(childId)}&select=event_id,event_name,source,entity_type,entity_id,payload,received_at&order=received_at.desc&limit=120`
    );
    if (result.ok && Array.isArray(result.data)) serverEvents = result.data;
    else serviceWarning = result.error || '';
  }
  const sourceEvents = serverEvents.length ? serverEvents : events;
  const serverCards = serverEvents
    .filter((item) => ['tutor_progress', 'review_completed', 'revisit_attempt', 'module_review_pack_imported'].includes(item.event_name))
    .slice(0, 12)
    .map((item, index) => ({
      id: item.event_id || `event_${index + 1}`,
      title: item.payload?.title || item.entity_type || item.event_name,
      reason: item.event_name,
      source: item.source || 'learning_event',
      due_stage: index < 4 ? 'day_1' : index < 8 ? 'day_7' : 'day_14'
    }));
  const dueCards = (serverCards.length ? serverCards : cards.filter((card) => card && !card.retired))
    .slice(0, Math.max(0, Number(body.limit || 50)));
  const reviewedCount = sourceEvents.filter((item) => item && (item.rating || item.event_name === 'review_completed' || item.event_name === 'revisit_completed')).length;

  return json({
    ok: true,
    source: serverEvents.length ? 'server_learning_events' : 'request_cards_only',
    service_ready: configured(),
    persisted: Boolean(serverEvents.length),
    service_contract: {
      ...serviceContract('mini_learning_events'),
      mode: serverEvents.length ? 'server_event_schedule' : 'request_records_only',
      evidence_required: ['cards', 'events', 'profile'],
      action_required: serverEvents.length ? '' : 'account_service_configuration'
    },
    date: new Date().toISOString().slice(0, 10),
    due_count: dueCards.length,
    due_cards: dueCards,
    reviewed_today: reviewedCount,
    daily_goal: {
      target: 10,
      completed: reviewedCount,
      achieved: reviewedCount >= 10
    },
    learning_record_total: points,
    progress_band: progressBand(points),
    xp: points,
    learning_record_stage: recordStage(points),
    local_record_points: points,
    next_action: dueCards.length ? 'review_due_cards' : 'create_or_import_learning_pack',
    display_notice: serverEvents.length
      ? 'Review uses confirmed learning evidence only; no rankings or reward claims.'
      : 'Review uses submitted local records only; no rankings or reward claims.',
    revisit_schedule: {
      day_1: dueCards.filter((card) => card.due_stage === 'day_1').length,
      day_7: dueCards.filter((card) => card.due_stage === 'day_7').length,
      day_14: dueCards.filter((card) => card.due_stage === 'day_14').length
    },
    persistence_warning: serviceWarning,
    engine_version: 'mini-review-records-today-v1.1'
  });
}
