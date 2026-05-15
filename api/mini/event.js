import {
    clean,
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';

export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'mini-event-v1.0';
const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const ALLOWED_EVENTS = new Set([
    'learning_event',
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
    'challenge_started',
    'arcade_started',
    'arcade_attempt',
    'arcade_completed',
    'share_card_generated',
    'share_app_message',
    'share_timeline',
    'share_clicked',
    'report_viewed',
    'lead_intent_opened',
    'lead_submitted'
]);

const SENSITIVE_KEY = /answer|phone|mobile|openid|token|secret|session|password|authorization|credential/i;

function scrub(value, depth = 0) {
    if (depth > 3) return '[truncated]';
    if (value == null) return value;
    if (typeof value === 'string') return clean(value, 180);
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 10).map((item) => scrub(item, depth + 1));
    if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => {
            const safeKey = clean(key, 60);
            return [safeKey, SENSITIVE_KEY.test(safeKey) ? '[redacted]' : scrub(item, depth + 1)];
        }));
    }
    return clean(String(value), 120);
}

function normalizeEvent(body = {}) {
    const rawEvent = clean(body.event || body.event_name || body.kind || '', 80);
    const event = ALLOWED_EVENTS.has(rawEvent) ? rawEvent : 'learning_event';
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : body;
    return {
        event,
        event_id: clean(body.id || body.event_id || body.mutation_id || '', 120),
        client_id: clean(body.client_id || body.clientId || '', 120),
        page: clean(body.page || payload.page || '', 80),
        source: clean(body.source || payload.source || payload.type || '', 80),
        entity_type: clean(body.entity_type || payload.entity_type || '', 60),
        entity_id: clean(body.entity_id || payload.entity_id || payload.card_id || payload.module_id || payload.id || '', 120),
        created_at: clean(body.created_at || payload.created_at || '', 40),
        payload: scrub(payload)
    };
}

function funnelHint(event) {
    if (event.event.startsWith('share_')) return 'share_to_activation';
    if (event.event.startsWith('arcade_')) return 'challenge_engagement';
    if (event.event.startsWith('tutor_')) return 'xiaodian_learning_loop';
    if (event.event.startsWith('review_')) return 'fsrs_return_loop';
    if (event.event.startsWith('module_') || event.event.startsWith('factory_')) return 'material_to_challenge';
    return 'learning_evidence';
}

function pgHeaders(extra = {}) {
    return {
        'content-type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        ...extra
    };
}

async function persistEvent(event, receivedAt) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { mode: 'local_receipt', persisted: false, action_required: 'service_configuration' };
    }
    const row = {
        event_id: event.event_id || `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        client_id: event.client_id || null,
        event_name: event.event,
        page: event.page || null,
        source: event.source || null,
        entity_type: event.entity_type || null,
        entity_id: event.entity_id || null,
        payload: event.payload || {},
        event_created_at: event.created_at || receivedAt,
        received_at: receivedAt
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/mini_learning_events?on_conflict=event_id`, {
        method: 'POST',
        headers: pgHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(row)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`event_store_failed:${res.status}:${text.slice(0, 160)}`);
    }
    return { mode: 'supabase', persisted: true, event_id: row.event_id };
}

async function readRequest(req) {
    try {
        return await readJson(req, 20 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST 请求。' }, 405);

    const limited = rateLimit(clientRateKey(req, 'mini:event'), 600);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: '请求过于频繁，请稍后再试。' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面。' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) {
        return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);
    }

    const event = normalizeEvent(body);
    const receivedAt = new Date().toISOString();
    try {
        const persisted = await persistEvent(event, receivedAt);
        const eventId = persisted.event_id || event.event_id || `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        return json({
            ok: true,
            event_id: eventId,
            received_at: receivedAt,
            mode: persisted.mode,
            persisted: persisted.persisted,
            action_required: persisted.action_required || '',
            event: Object.assign({}, event, { event_id: eventId }),
            funnel: funnelHint(event),
            service_contract: {
                table: 'mini_learning_events',
                primary_keys: ['event_id', 'client_id'],
                future_join_keys: ['session_id', 'student_id', 'share_code', 'card_id', 'module_id', 'deck_id']
            },
            engine_version: ENGINE_VERSION
        });
    } catch (error) {
        return json({
            ok: false,
            error: 'event_store_failed',
            message: error.message || 'event_store_failed',
            engine_version: ENGINE_VERSION
        }, 502);
    }
}
