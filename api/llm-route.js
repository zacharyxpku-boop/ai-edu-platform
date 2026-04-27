// 原点智学 · 统一 LLM 模型路由
// POST /api/llm-route
// Body: { task, messages, options? }
//   task ∈ 'general' | 'math' | 'diagnose' | 'embed' | 'fast'
// → { provider, model, content / embedding, latency_ms, tokens_used }
//
// 设计目的：
//   1. 上层端点（diagnose / retrieve / extract-signals / embed-dialogue）不再各自调 LLM
//   2. 路由策略集中维护：math 任务自动走 Qwen-Math（未来 Confucius3-Math），其他走 DeepSeek
//   3. 出错自动 fallback：DeepSeek 失败 → Qwen-Plus
//   4. 一处加 Confucius3-Math，全栈受益
//
// 路由表（可调）：
//   general   → DeepSeek 主 + Qwen 兜底
//   math      → 优先 Qwen-Math（未来 Confucius3-Math 14B）+ DeepSeek 兜底
//   diagnose  → DeepSeek（temperature 0.1，response_format json_object）
//   fast      → Qwen-Turbo（低 latency 场景，比如实时归因）
//   embed     → dashscope text-embedding-v3 1024 维

export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'llm-route-v1.0';

const DEEPSEEK_KEY = (typeof process !== 'undefined' && process.env) ? process.env.DEEPSEEK_KEY : '';
const QWEN_KEY = (typeof process !== 'undefined' && process.env) ? process.env.QWEN_KEY : '';
const CONFUCIUS_HOST = (typeof process !== 'undefined' && process.env) ? process.env.CONFUCIUS_HOST : ''; // 未来自部署 Confucius3-Math vLLM endpoint

const ENDPOINTS = {
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    qwen_embed: 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
};

// 任务路由策略
const ROUTE_TABLE = {
    general: [
        { provider: 'deepseek', model: 'deepseek-chat', temp: 0.7 },
        { provider: 'qwen', model: 'qwen-plus', temp: 0.7 },
    ],
    math: [
        // V2：CONFUCIUS_HOST 配上后优先走它
        { provider: 'qwen', model: 'qwen-math-plus', temp: 0.1 },
        { provider: 'deepseek', model: 'deepseek-chat', temp: 0.2 },
    ],
    diagnose: [
        { provider: 'deepseek', model: 'deepseek-chat', temp: 0.1, response_format: { type: 'json_object' } },
        { provider: 'qwen', model: 'qwen-plus', temp: 0.1 },
    ],
    fast: [
        { provider: 'qwen', model: 'qwen-turbo', temp: 0.5 },
        { provider: 'deepseek', model: 'deepseek-chat', temp: 0.5 },
    ],
};

function jsonErr(s, c, m) {
    return new Response(JSON.stringify({ ok: false, error: c, message: m }), {
        status: s, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

async function callConfucius(model, messages, options = {}) {
    if (!CONFUCIUS_HOST) return null;
    try {
        const r = await fetch(`${CONFUCIUS_HOST}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, temperature: options.temp || 0.1, max_tokens: options.max_tokens || 800 }),
        });
        if (!r.ok) return null;
        const data = await r.json();
        return { ok: true, content: data.choices?.[0]?.message?.content || '', usage: data.usage };
    } catch (e) { return null; }
}

async function callDeepSeek(model, messages, options) {
    if (!DEEPSEEK_KEY) return null;
    try {
        const body = {
            model, messages,
            temperature: options.temp ?? 0.5,
            max_tokens: options.max_tokens || 800,
        };
        if (options.response_format) body.response_format = options.response_format;
        const r = await fetch(ENDPOINTS.deepseek, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
            body: JSON.stringify(body),
        });
        if (!r.ok) return null;
        const data = await r.json();
        return { ok: true, content: data.choices?.[0]?.message?.content || '', usage: data.usage };
    } catch (e) { return null; }
}

async function callQwen(model, messages, options) {
    if (!QWEN_KEY) return null;
    try {
        const r = await fetch(ENDPOINTS.qwen, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + QWEN_KEY },
            body: JSON.stringify({
                model, messages,
                temperature: options.temp ?? 0.5,
                max_tokens: options.max_tokens || 800,
            }),
        });
        if (!r.ok) return null;
        const data = await r.json();
        return { ok: true, content: data.choices?.[0]?.message?.content || '', usage: data.usage };
    } catch (e) { return null; }
}

async function dispatch(provider, model, messages, options) {
    if (provider === 'deepseek') return callDeepSeek(model, messages, options);
    if (provider === 'qwen') return callQwen(model, messages, options);
    if (provider === 'confucius') return callConfucius(model, messages, options);
    return null;
}

async function callEmbed(input) {
    if (!QWEN_KEY) return null;
    const r = await fetch(ENDPOINTS.qwen_embed, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + QWEN_KEY },
        body: JSON.stringify({
            model: 'text-embedding-v3',
            input: Array.isArray(input) ? input : [input],
            dimensions: 1024,
        }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return { ok: true, embeddings: data.data.map(d => d.embedding) };
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (req.method !== 'POST') return jsonErr(405, 'method_not_allowed', '只接受 POST');

    let body;
    try { body = await req.json(); }
    catch (e) { return jsonErr(400, 'bad_json', '请求体不是合法 JSON'); }

    const { task = 'general', messages, options = {}, input } = body;

    // embed 任务特殊处理
    if (task === 'embed') {
        const t0 = Date.now();
        const r = await callEmbed(input || messages);
        if (!r) return jsonErr(502, 'embed_failed', 'dashscope 调用失败');
        return new Response(JSON.stringify({
            ok: true, task, provider: 'qwen', model: 'text-embedding-v3',
            embeddings: r.embeddings,
            latency_ms: Date.now() - t0,
            engine_version: ENGINE_VERSION,
        }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }

    if (!Array.isArray(messages) || !messages.length) return jsonErr(400, 'bad_messages', 'messages 必须是非空数组');

    const route = ROUTE_TABLE[task] || ROUTE_TABLE.general;

    // 按路由顺序尝试，第一个成功的返回
    for (const cfg of route) {
        const t0 = Date.now();
        const r = await dispatch(cfg.provider, cfg.model, messages, { ...cfg, ...options });
        if (r && r.ok && r.content) {
            return new Response(JSON.stringify({
                ok: true, task,
                provider: cfg.provider, model: cfg.model,
                content: r.content,
                usage: r.usage || null,
                latency_ms: Date.now() - t0,
                engine_version: ENGINE_VERSION,
            }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
        }
    }

    return jsonErr(502, 'all_providers_failed', `task=${task} 所有 provider 均失败`);
}
