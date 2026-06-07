import {
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';
import { calculateLearningRecordDelta, getLearningRecordStage, getProgressBand } from './_game.js';

export const config = { runtime: 'edge' };

async function readRequest(req) {
    try {
        return await readJson(req, 64 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST 请求。' }, 405);

    const limited = rateLimit(clientRateKey(req, 'mini:quiz-submit'), 300);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: '请求过于频繁，请稍后再试。' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面。' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);

    const answers = Array.isArray(body.answers) ? body.answers.slice(0, 50) : [];
    const correct = answers.filter((item) => !!item.correct).length;
    const learningRecordDelta = correct * calculateLearningRecordDelta('quiz_correct', body.streak_multiplier || 1);
    const oldXp = Number(body.profile?.xp || body.xp || 0);
    const xp = oldXp + learningRecordDelta;
    const accuracy = answers.length ? Math.round((correct / answers.length) * 100) : 0;

    return json({
        ok: true,
        persisted: false,
        service_contract: {
            mode: 'request_attempt_only',
            evidence_required: ['answers.correct', 'card_id'],
            action_required: 'account_service_configuration'
        },
        attempt_id: body.attempt_id || `quiz_${Date.now()}`,
        total: answers.length,
        correct,
        accuracy,
        learning_record_delta: learningRecordDelta,
        learning_record_total: xp,
        progress_band: getProgressBand(xp),
        xp_delta: learningRecordDelta,
        xp,
        learning_record_stage: getLearningRecordStage(xp),
        level: getLearningRecordStage(xp),
        should_repair_wrong_cause: answers.length > 0 && accuracy < 70,
        event: {
            kind: 'quiz_attempt',
            total: answers.length,
            correct,
            accuracy,
            learning_record_delta: learningRecordDelta,
            xp: learningRecordDelta,
            created_at: new Date().toISOString()
        },
        display_notice: '本次结果只作为学习证据记录，不提供额外权益，不做结果承诺。',
        engine_version: 'mini-quiz-evidence-submit-v1'
    });
}
