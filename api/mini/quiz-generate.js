import {
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';
import { quizQuestionFromCard } from './_game.js';

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

    const limited = rateLimit(clientRateKey(req, 'mini:quiz-generate'), 180);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: '请求过于频繁，请稍后再试。' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面。' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);

    const cards = Array.isArray(body.cards) ? body.cards : [];
    const limit = Math.max(1, Math.min(12, Number(body.limit || 6)));
    const questions = cards
        .filter((card) => card && card.question && card.answer)
        .slice(0, limit)
        .map(quizQuestionFromCard);

    return json({
        ok: true,
        persisted: false,
        service_contract: {
            mode: 'request_cards_only',
            evidence_required: ['cards.question', 'cards.answer'],
            action_required: 'account_service_configuration'
        },
        count: questions.length,
        questions,
        estimated_minutes: Math.max(1, Math.ceil(questions.length * 0.6)),
        source: questions.length ? 'real_cards' : 'empty',
        engine_version: 'mini-game-quiz-generate-v1'
    });
}
