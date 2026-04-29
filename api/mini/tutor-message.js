// 原点智学 · 小程序非流式私教端点
// POST /api/mini/tutor-message { mode, message, context }
// 不读 service_role，不接受 student_id 作为授权边界；小程序生产版再接微信 session 归属校验。

import { env } from '../_env.js';

export const config = { runtime: 'edge' };

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const ipBucket = new Map();

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

function clean(s, max = 1200) {
    if (typeof s !== 'string') return '';
    return s.trim().replace(/\u0000/g, '').slice(0, max);
}

function rateLimit(ip) {
    const day = new Date().toISOString().slice(0, 10);
    const key = `${ip}|${day}`;
    const count = (ipBucket.get(key) || 0) + 1;
    ipBucket.set(key, count);
    if (ipBucket.size > 4000) {
        for (const item of ipBucket.keys()) {
            if (!item.endsWith(`|${day}`)) ipBucket.delete(item);
        }
    }
    return count <= 40;
}

function localReply(message, context = {}) {
    const selected = context.selected_homework?.text || '第一项必须做';
    if (/答案|代写|直接写|帮我写/.test(message)) {
        return '我不能替你写答案。把你已经想到的第一步发来，我只给最小提示。';
    }
    const weak = (context.weak_points || []).map((item) => item.name).filter(Boolean).slice(0, 2).join('、') || '审题建模';
    return `先锁定「${selected}」。它和「${weak}」有关。你先别算答案，用一句话写：题目给了哪些条件，真正问的是什么？`;
}

function buildPrompt(mode, context = {}) {
    const weak = (context.weak_points || []).map((item) => `${item.name}:${item.reason || ''}`).join('；') || '暂无雷达，先按审题和关键错因处理';
    const selected = context.selected_homework?.text || '未指定，默认从必须做第一项开始';
    return [
        '你是原点智学小程序里的原小点，面向小学高年级到初一初二学生。',
        '你的定位：只辅导“必须做”和“关键错因”，不做通用闲聊，不替孩子写作业，不直接给完整答案。',
        '说话短、具体、像家教老师。每次最多 120 字。',
        '如果学生要答案，拒绝代写，并要求他说出自己的第一步。',
        '如果材料足够，先定位关键错因，再给一个最小提示。',
        `当前模式：${mode || 'homework'}`,
        `当前锁定作业：${selected}`,
        `当前弱点：${weak}`
    ].join('\n');
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST' }, 405);

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip')
        || 'unknown';
    if (!rateLimit(ip)) {
        return json({ ok: false, error: 'rate_limited', message: '今天对话次数较多，先休息一下。' }, 429);
    }

    let body = {};
    try { body = await req.json(); }
    catch (error) { return json({ ok: false, error: 'bad_json', message: '请求体不是合法 JSON' }, 400); }

    const mode = ['homework', 'diagnose', 'explain'].includes(body.mode) ? body.mode : 'homework';
    const message = clean(body.message, 1200);
    const context = body.context || {};
    if (!message) return json({ ok: false, error: 'missing_message', message: 'message 必填' }, 400);

    const key = env.deepseek();
    if (!key) {
        return json({
            ok: true,
            mode,
            reply: localReply(message, context),
            fallback: true,
            engine_version: 'mini-tutor-message-v1.0'
        });
    }

    try {
        const upstream = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                temperature: 0.35,
                max_tokens: 260,
                stream: false,
                messages: [
                    { role: 'system', content: buildPrompt(mode, context) },
                    { role: 'user', content: message }
                ]
            })
        });
        if (!upstream.ok) {
            return json({
                ok: true,
                mode,
                reply: localReply(message, context),
                fallback: true,
                upstream_status: upstream.status,
                engine_version: 'mini-tutor-message-v1.0'
            });
        }
        const data = await upstream.json();
        const reply = clean(data.choices?.[0]?.message?.content || '', 600) || localReply(message, context);
        return json({
            ok: true,
            mode,
            reply,
            fallback: false,
            engine_version: 'mini-tutor-message-v1.0'
        });
    } catch (error) {
        return json({
            ok: true,
            mode,
            reply: localReply(message, context),
            fallback: true,
            engine_version: 'mini-tutor-message-v1.0'
        });
    }
}
