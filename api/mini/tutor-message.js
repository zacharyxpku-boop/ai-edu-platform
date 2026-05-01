// 原点智学 · 小程序非流式学习陪练端点
// POST /api/mini/tutor-message { mode, message, context }
// 不读 service_role，不接受 student_id 作为授权边界；生产归属以 x-mini-session 为准。
import { env } from '../_env.js';
import {
    clean,
    clientIp,
    json,
    rateLimit,
    readJson,
    riskyContent,
    sessionSecret,
    verifySession
} from './_shared.js';

export const config = { runtime: 'edge' };

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

function localReply(message, context = {}) {
    const selected = clean(context.selected_homework?.text || '第一项必须做', 120);
    const risk = riskyContent(message);
    if (!risk.safe && risk.type === 'academic_integrity') {
        return '我不能替你写答案。把你已经想到的第一步发来，我只给最小提示。';
    }
    const weak = (context.weak_points || [])
        .map((item) => clean(item.name || '', 20))
        .filter(Boolean)
        .slice(0, 2)
        .join('、') || '审题建模';
    return `先锁定「${selected}」。它和「${weak}」有关。你先别算答案，用一句话写：题目给了哪些条件，真正问的是什么？`;
}

function selfHarmReply() {
    return '这个内容我不能继续展开。请先告诉家长或老师；如果你现在很难受，优先联系身边可信的大人或当地紧急支持渠道。';
}

function normalizeContext(context = {}) {
    return {
        selected_homework: context.selected_homework ? {
            id: clean(context.selected_homework.id || '', 40),
            text: clean(context.selected_homework.text || '', 240),
            reason: clean(context.selected_homework.reason || '', 160)
        } : null,
        weak_points: Array.isArray(context.weak_points)
            ? context.weak_points.slice(0, 4).map((item) => ({
                key: clean(item.key || '', 30),
                name: clean(item.name || '', 30),
                score: Number(item.score) || 0,
                reason: clean(item.reason || '', 180)
            }))
            : [],
        homework_plan: context.homework_plan ? { present: true } : null
    };
}

function buildPrompt(mode, context = {}) {
    const weak = (context.weak_points || [])
        .map((item) => `${item.name}:${item.reason || ''}`)
        .join('；') || '暂无雷达，先按审题和关键错因处理';
    const selected = context.selected_homework?.text || '未指定，默认从必须做第一项开始';
    return [
        '你是原点智学小程序里的原小点，面向小学高年级到初一初二学生。',
        '定位：只引导高优先级任务和关键错因，不做通用闲聊，不替孩子写作业，不直接给完整答案。',
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

    const ip = clientIp(req);
    const limited = rateLimit(`mini:tutor:${ip}`, 50);
    if (!limited.ok) {
        return json({ ok: false, error: 'rate_limited', message: '今天对话次数较多，先休息一下。' }, 429);
    }

    const envObj = (typeof process !== 'undefined' && process.env) || {};
    const sessionId = req.headers.get('x-mini-session') || '';
    const session = sessionId
        ? await verifySession(sessionId, sessionSecret(envObj))
        : { ok: true, mode: 'anonymous' };
    if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);

    let body = {};
    try {
        body = await readJson(req, 24 * 1024);
    } catch (error) {
        return json({
            ok: false,
            error: error.message === 'payload_too_large' ? 'payload_too_large' : 'bad_json',
            message: error.message === 'payload_too_large' ? '请求体过大' : '请求体不是合法 JSON'
        }, error.status || 400);
    }

    const mode = ['homework', 'diagnose', 'explain'].includes(body.mode) ? body.mode : 'homework';
    const message = clean(body.message, 1200);
    const context = normalizeContext(body.context || {});
    if (!message) return json({ ok: false, error: 'missing_message', message: 'message 必填' }, 400);

    const safety = riskyContent(message);
    if (!safety.safe) {
        return json({
            ok: true,
            mode,
            reply: safety.type === 'self_harm' ? selfHarmReply() : localReply(message, context),
            safety_blocked: safety.type === 'self_harm',
            homework_boundary: safety.type === 'academic_integrity',
            engine_version: 'mini-tutor-message-v1.2'
        });
    }

    const key = env.deepseek();
    if (!key) {
        return json({
            ok: true,
            mode,
            reply: localReply(message, context),
            fallback: true,
            engine_version: 'mini-tutor-message-v1.2'
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
                engine_version: 'mini-tutor-message-v1.2'
            });
        }
        const data = await upstream.json();
        const reply = clean(data.choices?.[0]?.message?.content || '', 600) || localReply(message, context);
        return json({
            ok: true,
            mode,
            reply,
            fallback: false,
            engine_version: 'mini-tutor-message-v1.2'
        });
    } catch (error) {
        return json({
            ok: true,
            mode,
            reply: localReply(message, context),
            fallback: true,
            engine_version: 'mini-tutor-message-v1.2'
        });
    }
}
