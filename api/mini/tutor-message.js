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

const COACH_STEPS = {
    read_problem: {
        label: '读题',
        next_action: '先用一句话说清题目真正问什么。'
    },
    find_conditions: {
        label: '找条件',
        next_action: '把已知条件和未知量分开列出来。'
    },
    write_first_step: {
        label: '写第一步',
        next_action: '只写第一步式子或第一句判断，不写完整答案。'
    },
    explain_misconception: {
        label: '说错因',
        next_action: '说清卡住的是审题、建模、计算还是表达。'
    },
    review: {
        label: '复盘',
        next_action: '用一句话总结下次先检查哪一步。'
    }
};

function normalizeTag(item) {
    if (typeof item === 'string') {
        return { label: clean(item, 30) };
    }
    if (!item || typeof item !== 'object') return null;
    const normalized = {
        axis: clean(item.axis || item.key || '', 30),
        label: clean(item.label || item.name || item.keyword || '', 30),
        hint: clean(item.hint || item.reason || '', 100)
    };
    return normalized.label || normalized.axis || normalized.hint ? normalized : null;
}

function normalizeTags(value) {
    if (!Array.isArray(value)) return [];
    return value.map(normalizeTag).filter(Boolean).slice(0, 5);
}

function misconceptionText(tags) {
    return normalizeTags(tags)
        .map((item) => item.label || item.axis)
        .filter(Boolean)
        .slice(0, 3)
        .join('、');
}

function inferCoachStep(message, requested) {
    if (COACH_STEPS[requested]) return requested;
    if (/复盘|总结|下次|检查点/.test(message)) return 'review';
    if (/错因|为什么错|卡住|不会|思路错/.test(message)) return 'explain_misconception';
    if (/第一步|怎么开始|开头|起步|列式/.test(message)) return 'write_first_step';
    if (/条件|已知|信息/.test(message)) return 'find_conditions';
    return 'read_problem';
}

function masterySignal(step, homeworkBoundary) {
    if (homeworkBoundary) {
        return {
            status: 'blocked_answer_request',
            confidence: 0.88,
            evidence_needed: '学生需要先给出自己的第一步或卡点。'
        };
    }
    if (step === 'review') {
        return {
            status: 'ready_for_parent_review',
            confidence: 0.78,
            evidence_needed: '学生需要说出本题错因和下次检查点。'
        };
    }
    return {
        status: 'needs_student_step',
        confidence: step === 'write_first_step' ? 0.75 : 0.66,
        evidence_needed: '学生需要补充自己的思路证据，而不是等待完整答案。'
    };
}

function localReply(message, context = {}, step = 'read_problem') {
    const selected = clean(context.selected_homework?.text || '第一项必须做', 120);
    const weak = (context.weak_points || [])
        .map((item) => clean(item.name || '', 20))
        .filter(Boolean)
        .slice(0, 2)
        .join('、') || '审题建模';
    const misconception = misconceptionText(context.selected_homework?.evidence?.misconception_tags || context.misconception_tags) || weak;

    if (riskyContent(message).type === 'academic_integrity') {
        return '我不能替你写答案。先把你想到的第一步发来，我只给最小提示。';
    }

    if (step === 'find_conditions') {
        return `先锁定「${selected}」。请列两列：已知条件、要解决的问题。先不算答案。`;
    }
    if (step === 'write_first_step') {
        return `现在只写第一步：应该先设什么量、列什么关系，或先画哪条辅助信息。不要写最后结果。`;
    }
    if (step === 'explain_misconception') {
        return `先说错因。它大概率卡在「${misconception}」。你用一句话说：刚才哪一步想错了？`;
    }
    if (step === 'review') {
        return `复盘一句话：这类题下次先检查「${misconception}」，再动笔。把你的复盘句发来。`;
    }
    return `先锁定「${selected}」。它和「${misconception}」有关。先别算答案，用一句话说题目真正问什么。`;
}

function selfHarmReply() {
    return '这个内容我不能继续展开。请先告诉家长或老师；如果你现在很难受，优先联系身边可信的大人或当地紧急支持渠道。';
}

function normalizeContext(context = {}) {
    const selected = context.selected_homework || null;
    const evidence = selected?.evidence || {};
    return {
        selected_homework: selected ? {
            id: clean(selected.id || '', 40),
            text: clean(selected.text || '', 240),
            reason: clean(selected.reason || '', 180),
            priority_vector: selected.priority_vector || {},
            evidence: {
                reason: clean(evidence.reason || '', 180),
                weak_point: evidence.weak_point || null,
                misconception_tags: normalizeTags(evidence.misconception_tags),
                calibration_key: clean(evidence.calibration_key || '', 80)
            }
        } : null,
        weak_points: Array.isArray(context.weak_points)
            ? context.weak_points.slice(0, 4).map((item) => ({
                key: clean(item.key || '', 30),
                name: clean(item.name || '', 30),
                score: Number(item.score) || 0,
                reason: clean(item.reason || '', 180)
            }))
            : [],
        misconception_tags: normalizeTags(context.misconception_tags),
        coach_step: clean(context.coach_step || '', 40),
        homework_plan: context.homework_plan ? { present: true } : null
    };
}

function buildPrompt(mode, context = {}, step = 'read_problem') {
    const weak = (context.weak_points || [])
        .map((item) => `${item.name}:${item.reason || ''}`)
        .join('；') || '暂无雷达，先按审题和关键错因处理';
    const selected = context.selected_homework?.text || '未指定，默认从必须做第一项开始';
    const misconception = misconceptionText(context.selected_homework?.evidence?.misconception_tags || context.misconception_tags) || '待识别';
    return [
        '你是原点智学小程序里的原小点，面向小学高年级到初中学生。',
        '定位：只引导高优先级任务和关键错因，不做通用闲聊，不替孩子写作业，不直接给完整答案。',
        '采用苏格拉底式最小提示：先让学生说自己的判断，再给一个具体下一步。',
        '每次最多 120 字。不要暴露内部推理。不要承诺提分。',
        '如果学生要答案，拒绝代写，并要求他说出自己的第一步。',
        '如果材料足够，先定位关键错因，再给一个最小提示。',
        `当前模式：${mode || 'homework'}`,
        `当前步骤：${COACH_STEPS[step]?.label || '读题'}`,
        `当前锁定作业：${selected}`,
        `当前弱点：${weak}`,
        `当前错因标签：${misconception}`
    ].join('\n');
}

function structuredReply(reply, mode, step, context = {}, extra = {}) {
    const selected = context.selected_homework || {};
    const tags = normalizeTags(
        (context.selected_homework?.evidence?.misconception_tags || []).concat(context.misconception_tags || [])
    );
    return {
        ok: true,
        mode,
        reply: clean(reply, 700),
        coach_step: step,
        coach_step_label: COACH_STEPS[step]?.label || '读题',
        next_action: extra.next_action || COACH_STEPS[step]?.next_action || COACH_STEPS.read_problem.next_action,
        mastery_signal: masterySignal(step, Boolean(extra.homework_boundary)),
        homework_boundary: Boolean(extra.homework_boundary),
        selected_homework: selected.text ? {
            id: clean(selected.id || '', 40),
            text: clean(selected.text || '', 180),
            reason: clean(selected.reason || selected.evidence?.reason || '', 160),
            calibration_key: clean(selected.evidence?.calibration_key || '', 80),
            priority_vector: selected.priority_vector || {}
        } : null,
        misconception_tags: tags,
        engine_version: 'mini-tutor-message-v1.3',
        ...extra.extra
    };
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') {
        return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST' }, 405);
    }

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
    if (!session.ok) {
        return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);
    }

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
    const coachStep = inferCoachStep(message, context.coach_step);
    if (!message) return json({ ok: false, error: 'missing_message', message: 'message 必填' }, 400);

    const safety = riskyContent(message);
    if (!safety.safe) {
        const step = safety.type === 'academic_integrity' ? 'write_first_step' : coachStep;
        return json(structuredReply(
            safety.type === 'self_harm' ? selfHarmReply() : localReply(message, context, step),
            mode,
            step,
            context,
            {
                homework_boundary: safety.type === 'academic_integrity',
                next_action: safety.type === 'academic_integrity'
                    ? '先发自己的第一步或卡住的条件，我只给最小提示。'
                    : COACH_STEPS[step]?.next_action,
                extra: { safety_blocked: safety.type === 'self_harm' }
            }
        ));
    }

    const key = env.deepseek();
    if (!key) {
        return json(structuredReply(localReply(message, context, coachStep), mode, coachStep, context, {
            extra: { fallback: true }
        }));
    }

    try {
        const upstream = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${key}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                temperature: 0.35,
                max_tokens: 260,
                stream: false,
                messages: [
                    { role: 'system', content: buildPrompt(mode, context, coachStep) },
                    { role: 'user', content: message }
                ]
            })
        });

        if (!upstream.ok) {
            return json(structuredReply(localReply(message, context, coachStep), mode, coachStep, context, {
                extra: { fallback: true, upstream_status: upstream.status }
            }));
        }

        const data = await upstream.json();
        const reply = clean(data.choices?.[0]?.message?.content || '', 600) || localReply(message, context, coachStep);
        return json(structuredReply(reply, mode, coachStep, context, {
            extra: { fallback: false }
        }));
    } catch (error) {
        return json(structuredReply(localReply(message, context, coachStep), mode, coachStep, context, {
            extra: { fallback: true }
        }));
    }
}
