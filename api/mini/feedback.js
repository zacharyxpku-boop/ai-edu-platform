// Yuandian miniapp feedback calibration service.
// POST /api/mini/feedback { kind,target_id,rating,bucket,reason,state_summary }
import {
    clean,
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from '../../lib/mini-shared.js';

export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'mini-feedback-v1.1';
const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const ALLOWED_KINDS = new Set(['homework_priority', 'radar_weakness', 'weekly_review']);
const ALLOWED_RATINGS = new Set(['accurate', 'off']);
const ALLOWED_BUCKETS = new Set(['must_do', 'flexible', 'can_skip', 'weekly', 'radar']);

function shortList(value, limit = 6) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, limit).map((item) => {
        if (typeof item === 'string') return clean(item, 60);
        return {
            key: clean(item?.key || '', 40),
            name: clean(item?.name || '', 60),
            score: Number.isFinite(Number(item?.score)) ? Number(item.score) : null
        };
    });
}

function normalizeFeedback(body = {}) {
    const kind = clean(body.kind || 'homework_priority', 40);
    const rating = clean(body.rating || '', 20);
    const bucket = clean(body.bucket || '', 30);
    const summary = body.state_summary || body.stateSummary || {};

    return {
        kind: ALLOWED_KINDS.has(kind) ? kind : 'homework_priority',
        target_id: clean(body.target_id || body.targetId || '', 80),
        rating: ALLOWED_RATINGS.has(rating) ? rating : '',
        bucket: ALLOWED_BUCKETS.has(bucket) ? bucket : '',
        reason: clean(body.reason || '', 160),
        item_text: clean(body.item_text || body.itemText || '', 180),
        calibration_key: clean(body.calibration_key || body.calibrationKey || body.evidence?.calibration_key || '', 120),
        priority_vector: typeof body.priority_vector === 'object' && body.priority_vector ? body.priority_vector : {},
        misconception_tags: shortList(body.misconception_tags || body.misconceptionTags || body.evidence?.misconception_tags, 8),
        state_summary: {
            grade: clean(summary.grade || '', 20),
            subject: clean(summary.subject || '', 20),
            weak_points: shortList(summary.weak_points || summary.weakPoints, 6)
        }
    };
}

function learningSignal(feedback) {
    const positive = feedback.rating === 'accurate';
    const target = feedback.calibration_key || feedback.bucket || feedback.kind;
    return {
        calibration_weight: positive ? 1 : -1,
        product_signal: positive ? 'keep_current_rule' : 'needs_rule_review',
        target,
        usable_for_calibration: Boolean(feedback.calibration_key || Object.keys(feedback.priority_vector || {}).length),
        next_use: positive
            ? 'continue_current_priority_rule'
            : 'lower_same_evidence_weight_and_request_more_context'
    };
}

function pgHeaders(extra = {}) {
    return {
        'content-type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        ...extra
    };
}

function makeFeedbackId() {
    return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function persistFeedback(feedback, signal, receivedAt, clientId) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { mode: 'local_receipt', persisted: false, action_required: 'service_configuration' };
    }
    const row = {
        feedback_id: makeFeedbackId(),
        client_id: clientId || null,
        kind: feedback.kind,
        target_id: feedback.target_id,
        rating: feedback.rating,
        bucket: feedback.bucket || null,
        reason: feedback.reason || null,
        item_text: feedback.item_text || null,
        calibration_key: feedback.calibration_key || null,
        priority_vector: feedback.priority_vector || {},
        misconception_tags: feedback.misconception_tags || [],
        state_summary: feedback.state_summary || {},
        learning_signal: signal || {},
        received_at: receivedAt,
        created_at: receivedAt
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/family_priority_feedback?on_conflict=feedback_id`, {
        method: 'POST',
        headers: pgHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(row)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`feedback_store_failed:${res.status}:${text.slice(0, 160)}`);
    }
    return { mode: 'supabase', persisted: true, feedback_id: row.feedback_id };
}

async function readRequest(req) {
    try {
        return await readJson(req, 12 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: 'POST only' }, 405);

    const limited = rateLimit(clientRateKey(req, 'mini:feedback'), 160);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: 'Too many requests. Please try again later.' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: 'Miniapp session is invalid. Please re-enter the page.' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) {
        return json({
            ok: false,
            error: body.__error.message === 'payload_too_large' ? 'payload_too_large' : 'bad_json',
            message: body.__error.message === 'payload_too_large' ? 'Request payload is too large.' : 'Request body must be valid JSON.'
        }, body.__error.status || 400);
    }

    const feedback = normalizeFeedback(body);
    if (!feedback.rating) return json({ ok: false, error: 'bad_rating', message: 'rating must be accurate or off' }, 400);
    if (!feedback.target_id) return json({ ok: false, error: 'missing_target', message: 'target_id is required' }, 400);

    const receivedAt = new Date().toISOString();
    const signal = learningSignal(feedback);
    try {
        const persisted = await persistFeedback(feedback, signal, receivedAt, clean(req.headers.get('x-mini-client') || '', 120));
        const feedbackId = persisted.feedback_id || makeFeedbackId();
        return json({
            ok: true,
            source: persisted.persisted ? 'supabase' : 'local_feedback_receipt',
            mode: persisted.mode || 'local_receipt',
            persisted: Boolean(persisted.persisted),
            action_required: persisted.action_required || '',
            feedback_id: feedbackId,
            received_at: receivedAt,
            feedback: Object.assign({}, feedback, { feedback_id: feedbackId }),
            learning_signal: signal,
            service_contract: {
                table: 'family_priority_feedback',
                primary_keys: ['feedback_id', 'target_id', 'calibration_key'],
                future_join_keys: ['session_id', 'student_id', 'homework_item_id', 'misconception_id']
            },
            ai_notice: 'Feedback calibrates priority rules. It is not a score promise or learning-outcome guarantee.',
            engine_version: ENGINE_VERSION
        });
    } catch (error) {
        const fallbackId = makeFeedbackId();
        return json({
            ok: true,
            source: 'local_feedback_receipt',
            mode: 'local_receipt',
            persisted: false,
            action_required: 'feedback_storage_unavailable',
            feedback_id: fallbackId,
            received_at: receivedAt,
            feedback: Object.assign({}, feedback, { feedback_id: fallbackId }),
            learning_signal: signal,
            service_contract: {
                table: 'family_priority_feedback',
                primary_keys: ['feedback_id', 'target_id', 'calibration_key'],
                future_join_keys: ['session_id', 'student_id', 'homework_item_id', 'misconception_id']
            },
            ai_notice: 'Feedback calibrates priority rules. It is not a score promise or learning-outcome guarantee.',
            engine_version: ENGINE_VERSION,
            persistence_warning: error.message || 'feedback_store_failed'
        });
    }
}
