// 原点智学 · NCDM Mastery Service Edge Proxy
// 把 /api/mastery-proxy/* 转发到 Fly.io 上的 yuandian-ncdm 服务
// 作用：①统一域名，避免 CORS 头疼 ②隐藏后端地址 ③可以加缓存/限流
//
// 配置环境变量：
//   NCDM_HOST   后端地址（如 https://yuandian-ncdm.fly.dev）
//
// 路由映射：
//   /api/mastery-proxy/vector?student_id=xxx       → NCDM_HOST/api/mastery/vector?student_id=xxx
//   /api/mastery-proxy/recommend?student_id=xxx&n=5 → NCDM_HOST/api/mastery/recommend?...
//   /api/mastery-proxy/healthz                     → NCDM_HOST/healthz

export const config = { runtime: 'edge' };

const NCDM_HOST = (typeof process !== 'undefined' && process.env)
    ? (process.env.NCDM_HOST || '').replace(/\/$/, '')
    : '';

const PROXY_PREFIX = '/api/mastery-proxy';

function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ error: code, message: msg }), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, POST, OPTIONS',
                'access-control-allow-headers': 'content-type, authorization'
            }
        });
    }

    if (!NCDM_HOST) {
        return jsonErr(503, 'not_configured', 'NCDM_HOST 环境变量未设置（开发期：用 mock 兜底）');
    }

    const url = new URL(req.url);
    const tail = url.pathname.replace(PROXY_PREFIX, ''); // /vector or /recommend or /healthz
    if (!tail) return jsonErr(400, 'bad_path', 'usage: /api/mastery-proxy/{vector|recommend|healthz}');

    // 健康检查特殊处理
    const remotePath = tail === '/healthz' ? '/healthz' : '/api/mastery' + tail;
    const target = NCDM_HOST + remotePath + url.search;

    try {
        const upstream = await fetch(target, {
            method: req.method,
            headers: {
                'content-type': req.headers.get('content-type') || 'application/json',
            },
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text(),
        });
        const ct = upstream.headers.get('content-type') || 'application/json';
        // 转发响应（含状态码），加缓存 60s 减压力
        return new Response(upstream.body, {
            status: upstream.status,
            headers: {
                'Content-Type': ct,
                'Cache-Control': upstream.status === 200 ? 'public, max-age=60' : 'no-store',
                'X-Proxy-Backend': 'yuandian-ncdm'
            }
        });
    } catch (e) {
        return jsonErr(502, 'upstream_unreachable', `NCDM 服务不可达: ${e.message}`);
    }
}
