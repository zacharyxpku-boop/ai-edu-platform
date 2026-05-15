import {
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from '../mini/_shared.js';
import { dueCards, getLevel, todayKey } from '../mini/_game.js';

export const config = { runtime: 'edge' };

async function readRequest(req) {
    try {
        return req.method === 'GET' ? {} : await readJson(req, 64 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (!['GET', 'POST'].includes(req.method)) return json({ ok: false, error: 'method_not_allowed' }, 405);

    const limited = rateLimit(clientRateKey(req, 'review:due-cards'), 180);
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
    const cards = Array.isArray(body.cards) ? body.cards : [];
    const events = Array.isArray(body.events) ? body.events : [];
    const profile = body.profile || {};
    const today = todayKey();
    const reviewedToday = events.filter((item) => String(item.created_at || '').slice(0, 10) === today && item.rating).length;
    const due = dueCards(cards, new Date(), body.limit || url.searchParams.get('limit') || 50);

    return json({
        ok: true,
        date: today,
        persisted: false,
        service_contract: {
            mode: 'request_cards_only',
            evidence_required: ['cards', 'events'],
            action_required: 'account_service_configuration'
        },
        due_count: due.length,
        due_cards: due,
        reviewed_today: reviewedToday,
        daily_goal: {
            target: 10,
            completed: reviewedToday,
            achieved: reviewedToday >= 10,
            remaining: Math.max(0, 10 - reviewedToday)
        },
        xp: Number(profile.xp || body.xp || 0),
        level: getLevel(profile.xp || body.xp || 0),
        source: due.length ? 'request_cards' : 'empty_without_client_cards',
        message: due.length ? '' : '请从小程序本机记录或已配置的账号服务传入真实卡片；接口不会生成假复习任务。',
        engine_version: 'review-due-cards-v1'
    });
}
