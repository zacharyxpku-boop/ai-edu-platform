// 原点智学 · 小程序内容安全预检
// POST /api/mini/content-check { content }
// 配置 WECHAT_APP_ID / WECHAT_APP_SECRET 后可升级为微信 msgSecCheck；当前先提供审核前本地兜底。

export const config = { runtime: 'edge' };

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type,x-mini-session'
        }
    });
}

function clean(s, max = 1500) {
    if (typeof s !== 'string') return '';
    return s.trim().replace(/\u0000/g, '').slice(0, max);
}

function localCheck(content) {
    const text = String(content || '').toLowerCase();
    const risks = [
        { word: '自杀', type: 'self_harm' },
        { word: '轻生', type: 'self_harm' },
        { word: '割腕', type: 'self_harm' },
        { word: 'kill myself', type: 'self_harm' },
        { word: '代写', type: 'academic_integrity' },
        { word: '帮我写完', type: 'academic_integrity' },
        { word: '直接给答案', type: 'academic_integrity' }
    ];
    const hit = risks.find((item) => text.includes(item.word));
    return hit
        ? { safe: false, type: hit.type, keyword: hit.word }
        : { safe: true, type: 'pass' };
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST' }, 405);

    let body = {};
    try { body = await req.json(); }
    catch (error) { return json({ ok: false, error: 'bad_json', message: '请求体不是合法 JSON' }, 400); }

    const content = clean(body.content || body.message || '');
    if (!content) return json({ ok: false, error: 'missing_content', message: 'content 必填' }, 400);

    const result = localCheck(content);
    return json({
        ok: true,
        provider: 'local-precheck',
        safe: result.safe,
        risk_type: result.type,
        keyword: result.keyword || '',
        next_step: result.safe ? 'allow' : 'block_or_redirect',
        engine_version: 'mini-content-check-v1.0'
    });
}
