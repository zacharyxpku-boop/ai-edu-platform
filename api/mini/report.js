import {
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';
import { getLevel, knowledgeGap } from './_game.js';

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

    const limited = rateLimit(clientRateKey(req, 'mini:report'), 180);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);

    const events = Array.isArray(body.events) ? body.events : [];
    const profile = body.profile || {};
    const cards = Array.isArray(body.cards) ? body.cards : [];
    const reviewed = events.filter((item) => item.rating);
    const wins = reviewed.filter((item) => ['remembered', 'good', 'easy'].includes(item.rating)).length;
    const accuracy = reviewed.length ? Math.round((wins / reviewed.length) * 100) : null;
    const xp = Number(profile.xp || 0);
    const gaps = knowledgeGap(events);

    return json({
        ok: true,
        source: 'local_learning_summary',
        persisted: false,
        service_contract: {
            mode: 'request_records_only',
            evidence_required: ['review_events', 'review_cards', 'profile_stats'],
            action_required: 'account_service_configuration'
        },
        weekly: {
            reviewed_cards: reviewed.length,
            accuracy,
            xp,
            level: getLevel(xp),
            due_cards: cards.filter((card) => !card.next_review || new Date(card.next_review).getTime() <= Date.now()).length,
            parent_summary: reviewed.length
                ? `本周完成 ${reviewed.length} 次回忆练习，正确率 ${accuracy}%；下一步优先修复 ${gaps[0]?.key || '最高频错因'}。`
                : '本周还没有足够学习记录。完成一次 5 分钟闯关后，这里会生成真实进展。'
        },
        knowledge_gap: gaps,
        engine_version: 'mini-learning-report-summary-v1'
    });
}
