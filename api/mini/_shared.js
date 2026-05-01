const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_MS = 7 * DAY_MS;
const rateBuckets = new Map();

function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type,x-mini-session',
            ...extraHeaders
        }
    });
}

function clean(value, max = 200) {
    if (typeof value !== 'string') return '';
    return value
        .trim()
        .replace(/\u0000/g, '')
        .replace(/[\r\t]/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .slice(0, max);
}

function clamp(value, min, max, fallback = min) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

async function readJson(req, maxBytes = 16 * 1024) {
    const raw = await req.text();
    if (raw.length > maxBytes) {
        const error = new Error('payload_too_large');
        error.status = 413;
        throw error;
    }
    try {
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        const badJson = new Error('bad_json');
        badJson.status = 400;
        throw badJson;
    }
}

function clientIp(req) {
    return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip')
        || 'unknown';
}

function rateLimit(key, limit, windowMs = DAY_MS) {
    const now = Date.now();
    const bucketKey = key || 'unknown';
    const current = rateBuckets.get(bucketKey);
    if (!current || current.resetAt <= now) {
        rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
        return { ok: true, remaining: Math.max(0, limit - 1), resetAt: now + windowMs };
    }
    current.count += 1;
    if (rateBuckets.size > 6000) {
        for (const [k, item] of rateBuckets.entries()) {
            if (item.resetAt <= now) rateBuckets.delete(k);
        }
    }
    return {
        ok: current.count <= limit,
        remaining: Math.max(0, limit - current.count),
        resetAt: current.resetAt
    };
}

function base64UrlFromBytes(bytes) {
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    const encoded = typeof btoa === 'function'
        ? btoa(binary)
        : Buffer.from(binary, 'binary').toString('base64');
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesFromBase64Url(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function hmac(body, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    return base64UrlFromBytes(new Uint8Array(signature));
}

async function signSession(payload, secret) {
    if (!secret || !globalThis.crypto?.subtle) {
        return `demo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
    const encoder = new TextEncoder();
    const body = base64UrlFromBytes(encoder.encode(JSON.stringify(payload)));
    const signature = await hmac(body, secret);
    return `${body}.${signature}`;
}

async function verifySession(sessionId, secret) {
    const token = clean(sessionId, 2048);
    if (!token) return { ok: false, mode: 'missing' };
    if (token.startsWith('demo_') || token.startsWith('local_')) {
        return { ok: true, mode: 'demo', payload: { mode: 'demo' } };
    }
    if (!secret || !globalThis.crypto?.subtle) return { ok: false, mode: 'unverifiable' };
    const parts = token.split('.');
    if (parts.length !== 2) return { ok: false, mode: 'malformed' };
    const expected = await hmac(parts[0], secret);
    if (expected !== parts[1]) return { ok: false, mode: 'bad_signature' };
    try {
        const body = new TextDecoder().decode(bytesFromBase64Url(parts[0]));
        const payload = JSON.parse(body);
        if (payload.exp && Number(payload.exp) < Date.now()) return { ok: false, mode: 'expired' };
        return { ok: true, mode: payload.mode || 'signed', payload };
    } catch (error) {
        return { ok: false, mode: 'bad_payload' };
    }
}

function sessionSecret(env = {}) {
    return env.MINI_SESSION_SECRET || env.WECHAT_APP_SECRET || env.MINIAPP_APP_SECRET || env.ADMIN_TOKEN || '';
}

function riskyContent(content) {
    const text = String(content || '').toLowerCase();
    const risks = [
        { word: '自杀', type: 'self_harm' },
        { word: '轻生', type: 'self_harm' },
        { word: '割腕', type: 'self_harm' },
        { word: '跳楼', type: 'self_harm' },
        { word: 'kill myself', type: 'self_harm' },
        { word: 'suicide', type: 'self_harm' },
        { word: 'self harm', type: 'self_harm' },
        { word: '代写', type: 'academic_integrity' },
        { word: '抄答案', type: 'academic_integrity' },
        { word: '帮我写完', type: 'academic_integrity' },
        { word: '帮我做完', type: 'academic_integrity' },
        { word: '帮我算完', type: 'academic_integrity' },
        { word: '直接给答案', type: 'academic_integrity' },
        { word: '直接写答案', type: 'academic_integrity' },
        { word: '最终答案', type: 'academic_integrity' },
        { word: '只要答案', type: 'academic_integrity' },
        { word: '给我答案', type: 'academic_integrity' },
        { word: '拍题求答案', type: 'academic_integrity' },
        { word: 'answer only', type: 'academic_integrity' },
        { word: 'give me the answer', type: 'academic_integrity' },
        { word: 'do my homework', type: 'academic_integrity' }
    ];
    const hit = risks.find((item) => text.includes(item.word));
    return hit
        ? { safe: false, type: hit.type, keyword: hit.word }
        : { safe: true, type: 'pass', keyword: '' };
}

export {
    SESSION_MAX_AGE_MS,
    clean,
    clamp,
    clientIp,
    json,
    rateLimit,
    readJson,
    riskyContent,
    sessionSecret,
    signSession,
    verifySession
};
