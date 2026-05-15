// 原点智学 · 小程序反馈校准服务
// POST /api/mini/feedback { kind,target_id,rating,bucket,reason,state_summary }
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
        usable_for_ranking: Boolean(feedback.calibration_key || Object.keys(feedback.priority_vector || {}).length),
        next_use: positive
            ? '继续强化当前分类依据。'
            : '下次排序时降低同类证据权重，并优先观察补充原因。'
    };
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
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST' }, 405);

    const limited = rateLimit(clientRateKey(req, 'mini:feedback'), 160);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: '请求过于频繁，请稍后再试' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) {
        return json({
            ok: false,
            error: body.__error.message === 'payload_too_large' ? 'payload_too_large' : 'bad_json',
            message: body.__error.message === 'payload_too_large' ? '请求体过大' : '请求体不是合法 JSON'
        }, body.__error.status || 400);
    }

    const feedback = normalizeFeedback(body);
    if (!feedback.rating) return json({ ok: false, error: 'bad_rating', message: '请标记为 accurate 或 off' }, 400);
    if (!feedback.target_id) return json({ ok: false, error: 'missing_target', message: '缺少反馈对象' }, 400);

    const receivedAt = new Date().toISOString();
    return json({
        ok: true,
        source: 'local_feedback_receipt',
        persisted: false,
        action_required: 'service_configuration',
        feedback_id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        received_at: receivedAt,
        feedback,
        learning_signal: learningSignal(feedback),
        service_contract: {
            table: 'family_priority_feedback',
            primary_keys: ['feedback_id', 'target_id', 'calibration_key'],
            future_join_keys: ['session_id', 'student_id', 'homework_item_id', 'misconception_id']
        },
        ai_notice: '该反馈用于改进排序依据，不作为学习结果承诺。',
        engine_version: 'mini-feedback-v1.0'
    });
}
