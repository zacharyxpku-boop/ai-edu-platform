import {
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './mini/_shared.js';
import { buildDeckFromText } from './mini/_game.js';

export const config = { runtime: 'edge' };

async function readRequest(req) {
    try {
        return await readJson(req, 128 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST 请求。' }, 405);

    const limited = rateLimit(clientRateKey(req, 'decks:create'), 120);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: '请求过于频繁，请稍后再试。' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面。' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);

    const result = buildDeckFromText(body || {});
    if (!result.cards.length) {
        return json({
            ok: false,
            error: 'empty_material',
            message: '请先输入真实学习材料，再生成闪卡组。'
        }, 400);
    }

    return json({
        ok: true,
        deck: result.deck,
        cards: result.cards,
        count: result.count,
        source: 'request_material',
        persisted: false,
        service_contract: {
            mode: 'request_material_only',
            evidence_required: ['text_or_content'],
            action_required: 'account_service_configuration'
        },
        engine_version: 'deck-create-v1'
    });
}
