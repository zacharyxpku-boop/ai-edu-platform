import {
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';
import { learningStageRecordState } from './_game.js';

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

    const state = learningStageRecordState(body.stats || body);
    const { achievements, ...safeState } = state;

    return json(Object.assign({
        ok: true,
        mode: 'local_learning_records',
        inventory_status: 'compatibility_retained_safe_copy',
        inventory_decision: 'retain_reword_safe_copy',
        persisted: false,
        service_contract: {
            mode: 'local_learning_records',
            evidence_required: ['stats.review_count', 'stats.correct_count', 'stats.streak'],
            action_required: 'account_service_configuration'
        },
        notice: '阶段记录只根据当前传入的学习记录计算，多端连续记录开通后再合并显示。',
        display_notice: '这里是阶段学习记录，不是外显荣誉或竞争体系。',
        engine_version: 'mini-learning-stage-records-v1'
    }, safeState));
}
