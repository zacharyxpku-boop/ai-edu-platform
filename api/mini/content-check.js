// 原点智学 · 小程序内容安全预检
// POST /api/mini/content-check { content }
// 有微信 access_token 时可扩展 msgSecCheck；当前先提供服务端统一规则和审核边界。
import {
    clean,
    clientIp,
    json,
    rateLimit,
    readJson,
    riskyContent
} from './_shared.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST' }, 405);

    const ip = clientIp(req);
    const limited = rateLimit(`mini:content:${ip}`, 180);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: '请求过于频繁，请稍后再试' }, 429);

    let body = {};
    try {
        body = await readJson(req, 8 * 1024);
    } catch (error) {
        return json({
            ok: false,
            error: error.message === 'payload_too_large' ? 'payload_too_large' : 'bad_json',
            message: error.message === 'payload_too_large' ? '请求体过大' : '请求体不是合法 JSON'
        }, error.status || 400);
    }

    const content = clean(body.content || body.message || '', 1500);
    if (!content) return json({ ok: false, error: 'missing_content', message: 'content 必填' }, 400);

    const result = riskyContent(content);
    return json({
        ok: true,
        provider: 'server-precheck',
        safe: result.safe,
        risk_type: result.type,
        keyword: result.keyword || '',
        next_step: result.safe ? 'allow' : 'block_or_redirect',
        engine_version: 'mini-content-check-v1.1'
    });
}
