// 原点智学 — 免费额度 AI 代理
// 把客户端的免费层调用挡在服务器侧，避免前端硬编码 API Key 外泄。
// BYOK（用户填了自己 Key）仍走前端直连，不经过这里。
//
// 环境变量（Vercel dashboard → Project Settings → Environment Variables）：
//   QWEN_KEY       - 通义千问（默认免费层）
//   DEEPSEEK_KEY   - DeepSeek（可选）
//
// 请求示例：
//   POST /api/ai-proxy
//   { "provider":"qwen", "messages":[{"role":"user","content":"..."}],
//     "model":"qwen-plus", "temperature":0.7, "max_tokens":1024, "stream":true }

export const config = { runtime: 'edge' };

const PROVIDERS = {
    qwen: {
        url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        env: 'QWEN_KEY',
        defaultModel: 'qwen-plus'
    },
    deepseek: {
        url: 'https://api.deepseek.com/v1/chat/completions',
        env: 'DEEPSEEK_KEY',
        defaultModel: 'deepseek-chat'
    }
};

// 每个 IP 每天上限，防刷
const IP_LIMIT_PER_DAY = 20;
const ipBucket = new Map(); // edge runtime 无状态，重启清零；够用挡住随手刷

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function ratelimit(ip) {
    const k = ip + '|' + todayKey();
    const n = (ipBucket.get(k) || 0) + 1;
    ipBucket.set(k, n);
    if (ipBucket.size > 5000) {
        // 粗粒度清理，防 memory 膨胀
        const today = todayKey();
        for (const key of ipBucket.keys()) {
            if (!key.endsWith('|' + today)) ipBucket.delete(key);
        }
    }
    return n <= IP_LIMIT_PER_DAY;
}

function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ error: code, message: msg }), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'POST, OPTIONS',
                'access-control-allow-headers': 'content-type'
            }
        });
    }
    if (req.method !== 'POST') return jsonErr(405, 'method_not_allowed', '只接受 POST');

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip')
        || 'unknown';
    if (!ratelimit(ip)) {
        return jsonErr(429, 'rate_limited', '今日免费额度已用完，明天再来或填入你自己的 API Key');
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return jsonErr(400, 'bad_json', '请求体不是合法 JSON');
    }

    const providerKey = body.provider || 'qwen';
    const cfg = PROVIDERS[providerKey];
    if (!cfg) return jsonErr(400, 'bad_provider', '不支持的 provider: ' + providerKey);

    const key = (typeof process !== 'undefined' && process.env) ? process.env[cfg.env] : '';
    if (!key) return jsonErr(500, 'not_configured', cfg.env + ' 未配置，请联系管理员');

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return jsonErr(400, 'bad_messages', 'messages 必须是非空数组');
    }

    const payload = {
        model: body.model || cfg.defaultModel,
        messages: body.messages,
        temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
        max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : 1024,
        stream: !!body.stream
    };

    let upstream;
    try {
        upstream = await fetch(cfg.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + key
            },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        return jsonErr(502, 'upstream_network', '上游不可达: ' + e.message);
    }

    // 透传上游响应（含流式 SSE）
    const ct = upstream.headers.get('content-type') || 'application/json';
    return new Response(upstream.body, {
        status: upstream.status,
        headers: {
            'content-type': ct,
            'cache-control': 'no-store',
            'x-ydzx-proxy': '1'
        }
    });
}
