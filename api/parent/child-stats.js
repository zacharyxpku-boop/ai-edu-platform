import {
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from '../mini/_shared.js';
import { getLearningRecordStage, getProgressBand, knowledgeGap } from '../mini/_game.js';

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

    const limited = rateLimit(clientRateKey(req, 'parent:child-stats'), 180);
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
    const reviewed = events.filter((item) => item.rating);
    const correct = reviewed.filter((item) => ['remembered', 'good', 'easy'].includes(item.rating)).length;
    const accuracy = reviewed.length ? Math.round((correct / reviewed.length) * 100) : null;
    const xp = Number(profile.xp || 0);
    const progressBand = getProgressBand(xp);
    const gaps = knowledgeGap(events);

    return json({
        ok: true,
        source: env.SUPABASE_URL ? 'configured_service_or_request' : 'request_or_local_only',
        persisted: false,
        service_contract: {
            mode: env.SUPABASE_URL ? 'configured_service_available' : 'request_records_only',
            evidence_required: ['events', 'profile'],
            action_required: env.SUPABASE_URL ? '' : 'account_service_configuration'
        },
        stats: {
            reviewed_cards: reviewed.length,
            learning_record_total: xp,
            progress_band: progressBand,
            xp,
            learning_record_stage: getLearningRecordStage(xp),
            level: getLearningRecordStage(xp),
            record_points: Number(profile.recordPoints || profile.coins || 0),
            streak: Number(profile.streak || 0),
            accuracy,
            weak_points: gaps,
            summary: reviewed.length
                ? `孩子已完成 ${reviewed.length} 次回忆练习，当前正确率 ${accuracy}%。`
                : '还没有足够学习记录，完成一次复习回访后会显示真实进展。'
        },
        privacy_notice: '仅返回学习证据摘要，不返回私密对话全文。',
        display_notice: '家长端只展示孩子自己的学习证据摘要，不展示同伴比较、额外权益或结果承诺。',
        engine_version: 'parent-child-stats-v1'
    });
}
