import {
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';
import { dueCards, getLevel, todayKey } from './_game.js';

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

    const limited = rateLimit(clientRateKey(req, 'mini:review-today'), 180);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: 'Too many requests.' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: 'Mini session is invalid.' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);

    const cards = Array.isArray(body.cards) ? body.cards : [];
    const events = Array.isArray(body.events) ? body.events : [];
    const profile = body.profile || {};
    const today = todayKey();
    const reviewedToday = events.filter((item) => String(item.created_at || '').slice(0, 10) === today && item.rating).length;
    const due = dueCards(cards, new Date(), body.limit || 50);
    const level = getLevel(profile.xp || body.xp || 0);

    return json({
        ok: true,
        source: 'request_cards_only',
        persisted: false,
        service_contract: {
            mode: 'request_records_only',
            evidence_required: ['cards', 'events', 'profile'],
            action_required: 'account_service_configuration'
        },
        date: today,
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
        level,
        coins: Number(profile.coins || 0),
        streak: Number(profile.streak || 0),
        lives: Math.max(0, Number(profile.lives || 5)),
        next_action: due.length ? 'review_due_cards' : 'create_or_import_learning_pack',
        engine_version: 'mini-game-review-today-v1'
    });
}
