import {
    clean,
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from '../mini/_shared.js';

export const config = { runtime: 'edge' };

async function readRequest(req) {
    try {
        return await readJson(req, 32 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

function makeBindCode(childId, parentId) {
    const base = `${childId || 'child'}:${parentId || 'parent'}:${new Date().toISOString().slice(0, 10)}`;
    let hash = 2166136261;
    for (let i = 0; i < base.length; i += 1) {
        hash ^= base.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `YD${(hash >>> 0).toString(36).toUpperCase().slice(0, 6)}`;
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

    const limited = rateLimit(clientRateKey(req, 'parent:bind'), 80);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);

    const childId = clean(body.child_id || body.client_id || '', 120);
    const parentId = clean(body.parent_id || body.parent_client_id || '', 120);
    if (!childId) return json({ ok: false, error: 'missing_child_id', message: '缺少学生端标识。' }, 400);

    return json({
        ok: true,
        bind_id: `bind_${makeBindCode(childId, parentId).toLowerCase()}`,
        bind_code: makeBindCode(childId, parentId),
        status: env.SUPABASE_URL ? 'service_configured' : 'local_contract_only',
        persisted: false,
        service_contract: {
            mode: env.SUPABASE_URL ? 'configured_service_available' : 'local_contract_only',
            evidence_required: ['child_id', 'parent_id'],
            action_required: env.SUPABASE_URL ? '' : 'account_service_configuration'
        },
        message: env.SUPABASE_URL
            ? '已生成绑定记录，可写入已配置的账号服务。'
            : '当前未完成账号与多设备连续性配置，仅返回本机绑定凭证；正式多端使用前请完成服务配置。',
        privacy_notice: '家长查看范围限于学习进度、复习数量、XP、正确率趋势和错因统计，不开放孩子私聊社交。',
        engine_version: 'parent-bind-v1'
    });
}
