import {
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';
import { calculateXP, getLevel } from './_game.js';

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
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: 'Only POST is allowed.' }, 405);

    const limited = rateLimit(clientRateKey(req, 'mini:quiz-submit'), 300);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: 'Too many quiz submissions.' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: 'Mini session is invalid.' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);

    const answers = Array.isArray(body.answers) ? body.answers.slice(0, 50) : [];
    const correct = answers.filter((item) => !!item.correct).length;
    const xpDelta = correct * calculateXP('quiz_correct', body.streak_multiplier || 1);
    const oldXp = Number(body.profile?.xp || body.xp || 0);
    const xp = oldXp + xpDelta;
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
        xp_delta: xpDelta,
        xp,
        level: getLevel(xp),
        should_repair_wrong_cause: answers.length > 0 && accuracy < 70,
        event: {
            kind: 'quiz_attempt',
            total: answers.length,
            correct,
            accuracy,
            xp: xpDelta,
            created_at: new Date().toISOString()
        },
        engine_version: 'mini-game-quiz-submit-v1'
    });
}
