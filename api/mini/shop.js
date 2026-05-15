import {
    clean,
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';
import { purchaseItem, shopItems } from './_game.js';

export const config = { runtime: 'edge' };

async function readRequest(req) {
    try {
        return req.method === 'GET' ? {} : await readJson(req, 32 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (!['GET', 'POST'].includes(req.method)) return json({ ok: false, error: 'method_not_allowed' }, 405);

    const limited = rateLimit(clientRateKey(req, 'mini:shop'), 240);
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
    const wantsPurchase = body.action === 'purchase' || url.pathname.endsWith('/purchase');

    if (req.method === 'GET' || !wantsPurchase) {
        return json({
            ok: true,
            mode: 'local_learning_rewards',
            persisted: false,
            service_contract: {
                mode: 'local_learning_rewards',
                evidence_required: ['profile.inventory', 'profile.learning_points'],
                action_required: 'account_service_configuration'
            },
            items: shopItems(body.inventory || []),
            economy_notice: '这是本机学习激励，不是现金权益；只根据真实学习行为记录，不支持人民币充值。',
            action_required: 'account_service_configuration',
            engine_version: 'mini-game-shop-v1'
        });
    }

    const result = purchaseItem(body.user || {}, clean(body.item_id || '', 80));
    return json(Object.assign({
        mode: 'local_learning_rewards',
        persisted: false,
        service_contract: {
            mode: 'local_learning_rewards',
            evidence_required: ['user.inventory', 'user.learning_points'],
            action_required: 'account_service_configuration'
        },
        action_required: 'account_service_configuration',
        engine_version: 'mini-game-shop-v1'
    }, result), result.error === 'item_not_found' ? 404 : 200);
}
