import {
    clean,
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from '../../mini/_shared.js';

export const config = { runtime: 'edge' };

async function readRequest(req) {
    try {
        return req.method === 'GET' ? {} : await readJson(req, 128 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (!['GET', 'POST'].includes(req.method)) return json({ ok: false, error: 'method_not_allowed' }, 405);

    const limited = rateLimit(clientRateKey(req, 'decks:cards'), 240);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);

    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const deckId = clean(body.deck_id || parts[parts.length - 2] || '', 80);
    const cards = Array.isArray(body.cards)
        ? body.cards.filter((card) => !deckId || card.deck_id === deckId || card.deckId === deckId)
        : [];

    return json({
        ok: true,
        deck_id: deckId,
        cards,
        count: cards.length,
        persisted: false,
        service_contract: {
            mode: 'request_cards_only',
            evidence_required: ['cards'],
            action_required: 'account_service_configuration'
        },
        source: cards.length ? 'request_material' : 'empty_without_service_cards',
        message: cards.length ? '' : '请从小程序本机记录或已配置的账号服务传入真实卡片；接口不会生成假卡组。',
        engine_version: 'deck-cards-v1'
    });
}
