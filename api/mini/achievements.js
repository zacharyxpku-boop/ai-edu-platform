import {
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';
import { achievementState } from './_game.js';

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

    const limited = rateLimit(clientRateKey(req, 'mini:achievements'), 240);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);
    return json(Object.assign({
        ok: true,
        mode: 'local_learning_rewards',
        persisted: false,
        service_contract: {
            mode: 'local_learning_rewards',
            evidence_required: ['stats.review_count', 'stats.correct_count', 'stats.streak'],
            action_required: 'account_service_configuration'
        },
        notice: '成就只根据本机传入的学习记录计算，未完成账号服务配置前不作为跨设备记录。',
        engine_version: 'mini-game-achievements-v1'
    }, achievementState(body.stats || body)));
}
