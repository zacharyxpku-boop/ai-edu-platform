import {
    clean,
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';
import { localLeaderboard } from './_game.js';

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

    const limited = rateLimit(clientRateKey(req, 'mini:leaderboard'), 240);
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
    const scope = clean(body.scope || url.searchParams.get('scope') || 'local', 20);
    const week = clean(body.week || url.searchParams.get('week') || '', 20);

    if (scope !== 'local' && !env.SUPABASE_URL) {
        return json({
            ok: true,
            scope: 'local',
            requested_scope: scope,
            week,
            reason: 'service_not_configured',
            persisted: false,
            service_contract: {
                mode: 'local_self_snapshot',
                evidence_required: ['profile', 'events'],
                action_required: 'account_service_configuration'
            },
            rows: localLeaderboard(body.profile || {}, body.events || []),
            notice: '当前只展示本机学习进展；班级或好友榜会在连续记录稳定后再开放，避免展示未验证的数据。',
            engine_version: 'mini-game-leaderboard-v1'
        });
    }

    return json({
        ok: true,
        scope: 'local',
        week,
        persisted: false,
        service_contract: {
            mode: 'local_self_snapshot',
            evidence_required: ['profile', 'events'],
            action_required: 'account_service_configuration'
        },
        rows: localLeaderboard(body.profile || {}, body.events || []),
        engine_version: 'mini-game-leaderboard-v1'
    });
}
