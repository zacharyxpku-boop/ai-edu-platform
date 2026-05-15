// 原点智学 · 小程序会话边界
// POST /api/mini/session { code, profile? }
// 未配置微信凭据时返回本地会话；配置 WECHAT_APP_ID + WECHAT_APP_SECRET 后切换真实 openid。
import {
    SESSION_MAX_AGE_MS,
    clean,
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    signSession
} from './_shared.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST' }, 405);

    const limited = rateLimit(clientRateKey(req, 'mini:session'), 80);
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

    const env = (typeof process !== 'undefined' && process.env) || {};
    const appid = env.WECHAT_APP_ID || env.MINIAPP_APP_ID || '';
    const secret = env.WECHAT_APP_SECRET || env.MINIAPP_APP_SECRET || '';
    const code = clean(body.code, 128);
    const profile = body.profile || {};

    let openid = '';
    let mode = 'local';
    if (appid && secret && code && code !== 'local') {
        try {
            const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
            const upstream = await fetch(url, { method: 'GET' });
            const data = await upstream.json();
            if (data.openid) {
                openid = data.openid;
                mode = 'wechat';
            }
        } catch (error) {
            mode = 'local';
        }
    }

    const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
    const payload = {
        v: 2,
        mode,
        openid_hash: openid ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(openid)).then((buf) => Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')) : '',
        grade: clean(profile.grade || '', 20),
        exp: expiresAt
    };
    const sessionId = await signSession(payload, sessionSecret(env));

    return json({
        ok: true,
        mode,
        service_ready: mode === 'wechat',
        persisted: false,
        service_contract: {
            mode: mode === 'wechat' ? 'wechat_session' : 'local_session',
            evidence_required: ['wx_login_code'],
            action_required: mode === 'wechat' ? '' : 'wechat_appid_secret_configuration'
        },
        openid_hash: payload.openid_hash,
        session_id: sessionId,
        expires_at: new Date(expiresAt).toISOString(),
        message: mode === 'wechat' ? '微信会话已建立' : '本地会话已建立，完成 AppID/AppSecret 配置后启用真实登录'
    });
}
