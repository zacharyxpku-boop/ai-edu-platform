// 原点智学 · 小程序会话边界
// POST /api/mini/session { code, profile? }
// MVP 支持 tourist/demo 模式；配置 WECHAT_APP_ID + WECHAT_APP_SECRET 后可换取 openid。

export const config = { runtime: 'edge' };

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type'
        }
    });
}

function clean(s, max = 80) {
    if (typeof s !== 'string') return '';
    return s.trim().replace(/[\r\n\t]/g, ' ').slice(0, max);
}

function base64UrlFromBytes(bytes) {
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    const encoded = typeof btoa === 'function'
        ? btoa(binary)
        : Buffer.from(binary, 'binary').toString('base64');
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signSession(payload, secret) {
    if (!secret || !globalThis.crypto?.subtle) return `demo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const encoder = new TextEncoder();
    const body = base64UrlFromBytes(encoder.encode(JSON.stringify(payload)));
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    return `${body}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST' }, 405);

    let body = {};
    try { body = await req.json(); }
    catch (error) { return json({ ok: false, error: 'bad_json', message: '请求体不是合法 JSON' }, 400); }

    const env = (typeof process !== 'undefined' && process.env) || {};
    const appid = env.WECHAT_APP_ID || env.MINIAPP_APP_ID || '';
    const secret = env.WECHAT_APP_SECRET || env.MINIAPP_APP_SECRET || '';
    const sessionSecret = env.MINI_SESSION_SECRET || secret || env.ADMIN_TOKEN || '';
    const code = clean(body.code, 128);
    const profile = body.profile || {};

    let openid = '';
    let mode = 'demo';
    if (appid && secret && code && code !== 'demo') {
        try {
            const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
            const upstream = await fetch(url);
            const data = await upstream.json();
            if (data.openid) {
                openid = data.openid;
                mode = 'wechat';
            } else {
                mode = 'demo';
            }
        } catch (error) {
            mode = 'demo';
        }
    }

    const expiresAt = Date.now() + 7 * 24 * 3600 * 1000;
    const payload = {
        v: 1,
        mode,
        openid: openid ? openid.slice(0, 12) : '',
        grade: clean(profile.grade || '', 20),
        exp: expiresAt
    };
    const sessionId = await signSession(payload, sessionSecret);

    return json({
        ok: true,
        mode,
        session_id: sessionId,
        expires_at: new Date(expiresAt).toISOString(),
        message: mode === 'wechat' ? '微信会话已建立' : '本地体验模式，配置 AppID/AppSecret 后启用真实登录'
    });
}
