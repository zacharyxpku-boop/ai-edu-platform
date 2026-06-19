import { env } from '../../lib/env.js';
import {
    clean,
    clientRateKey,
    json,
    rateLimit,
    readJson,
    riskyContent,
    sessionSecret,
    verifySession
} from '../../lib/mini-shared.js';
import { insertRows, nowIso, safeId, scrub } from '../../lib/mini-store.js';

export const config = { runtime: 'edge' };

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const TUTOR_UPSTREAM_TIMEOUT_MS = 7000;

const COACH_STEPS = {
    check_answer: {
        label: '核对答案',
        next_action: '发题目和你写的答案，我只做核对和一句检查提醒。'
    },
    fast_mode: {
        label: '加速模式',
        next_action: '发题目和当前答案，我用三句说清：对不对、错在哪、下次先查什么。'
    },
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
    explain_full: {
        label: '讲透这题',
        next_action: '我分步骤讲清关键方法，但不替你抄完整作业。'
    },
    transfer: {
        label: '举一反三',
        next_action: '先说同类题第一步检查点，再做一个小变式。'
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

function normalizeParentGoal(goal = {}) {
    if (!goal || typeof goal !== 'object') return null;
    const normalized = {
        id: clean(goal.id || '', 30),
        label: clean(goal.label || '', 30),
        strategy: clean(goal.strategy || '', 120),
        tutorMode: clean(goal.tutorMode || goal.tutor_mode || '', 40),
        reviewBias: clean(goal.reviewBias || goal.review_bias || '', 40)
    };
    return normalized.id || normalized.label || normalized.strategy ? normalized : null;
}

function answerFromText(text) {
    const patterns = [
        /(?:我(?:写|算|选|做)的)?(?:答案|结果)?(?:是|为|=|：|:)\s*([A-Za-z0-9+\-*/().分之%√π]+)\s*$/i,
        /(?:选|答案选)\s*([A-D])\s*$/i
    ];
    for (const pattern of patterns) {
        const hit = String(text || '').match(pattern);
        if (hit && hit[1]) return clean(hit[1], 40);
    }
    return '';
}

const COACH_STEP_ALIASES = {
    find_first_step: 'write_first_step',
    first_step: 'write_first_step',
    stuck_first_step: 'write_first_step',
    start_hint: 'write_first_step'
};

function inferCoachStep(message, requested) {
    const requestedStep = COACH_STEP_ALIASES[requested] || requested;
    if (COACH_STEPS[requestedStep]) return requestedStep;
    if (/第一步|第1步|怎么开始|从哪开始|开头|起步|列式|不知道先找什么|不知道从哪|先找什么|先写什么/.test(message)) return 'write_first_step';
    if (/题意|读不懂题|看不懂题|条件|已知|信息/.test(message) && !/讲透|讲清楚|完整讲/.test(message)) return 'find_conditions';
    if (COACH_STEPS[requested]) return requested;
    if (/核对|对答案|我写的答案|答案是|结果是/.test(message)) return 'check_answer';
    if (/赶时间|加速|三句|快点/.test(message)) return 'fast_mode';
    if (/讲透|讲清楚|完整讲|看不懂/.test(message)) return 'explain_full';
    if (/举一反三|变式|同类题|迁移/.test(message)) return 'transfer';
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
    if (step === 'check_answer') {
        return {
            status: 'answer_check_allowed',
            confidence: 0.76,
            evidence_needed: '学生需要提供自己的答案，系统只做核对和短提醒。'
        };
    }
    if (step === 'fast_mode') {
        return {
            status: 'fast_check',
            confidence: 0.74,
            evidence_needed: '学生需要给出当前答案或卡点。'
        };
    }
    if (step === 'explain_full') {
        return {
            status: 'explain_requested',
            confidence: 0.75,
            evidence_needed: '学生需要在每一步后确认是否理解。'
        };
    }
    if (step === 'transfer') {
        return {
            status: 'transfer_check',
            confidence: 0.72,
            evidence_needed: '学生需要说明同类题第一步为什么不变。'
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

function detectApiTaskType(text = '', selected = {}) {
    const source = `${text || ''} ${selected.text || ''} ${selected.task_type || ''}`;
    if (/应用题|方程|数量|单位|等量|几何|函数|数学/.test(source)) return 'math_problem';
    if (/阅读|文章|主旨|细节|英语|语文|材料/.test(source)) return 'reading';
    if (/实验|现象|化学|物理|生物|受力|电路/.test(source)) return 'science';
    if (/单词|词语|定义|公式|概念|背/.test(source)) return 'memory_card';
    return selected.task_type || 'general_homework';
}

function buildApiSocraticRuntime(message = '', context = {}, step = 'read_problem') {
    const selected = context.selected_homework || {};
    const taskType = detectApiTaskType(message, selected);
    const tags = normalizeTags((selected.evidence?.misconception_tags || []).concat(context.misconception_tags || []));
    const misconception = tags[0]?.label || tags[0]?.axis || selected.evidence?.weak_point || '第一步入口不清';
    const selectedText = selected.text || message || '当前材料';
    const firstStepPrompt = step === 'find_conditions'
        ? '先把已知条件、目标问题分成两列。'
        : step === 'write_first_step'
            ? '只写第一步，不写完整答案。'
            : '先用一句话说题目真正问什么。';
    const threeRoundProtocol = [
        { round: 1, goal: '定位入口', ask: firstStepPrompt, stopWhen: '孩子能说出一个可执行的第一步' },
        { round: 2, goal: '要证据', ask: '哪个条件支持你这样开始？', stopWhen: '孩子能指出题干里的依据' },
        { round: 3, goal: '迁移验证', ask: '如果换一个数字或条件，第一步还一样吗？', stopWhen: '孩子能说出同类题的检查点' }
    ];
    const blackboardRecovery = {
        trigger: '连续两轮仍说不出第一步或只说不会',
        childLine: '先二选一：A 圈已知条件，B 说题目问什么。',
        parentLine: '家长只问 A/B，不追完整过程。',
        evidenceRequired: ['child_micro_choice', 'first_step', 'wrong_cause']
    };
    const transferCheck = {
        prompt: '换一道同类小题，只检查第一步和错因。',
        route: '/pages/review/review?from=socratic_runtime',
        evidenceRequired: ['near_transfer_attempted', 'next_day_revisit']
    };
    return {
        id: 'api_socratic_runtime_v2',
        taskType,
        selectedText: clean(selectedText, 160),
        misconception: clean(misconception, 60),
        activeStep: step,
        firstStepPrompt,
        allowedMoves: ['ask_first_step', 'ask_evidence', 'offer_two_choice_blackboard', 'near_transfer_check'],
        blockedMoves: ['write_full_answer', 'solve_entire_homework', 'rank_or_label_child'],
        threeRoundProtocol,
        blackboardRecovery,
        transferCheck,
        releaseGate: 'first_step_and_wrong_cause_before_practice'
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

    if (step === 'check_answer') {
        const answer = answerFromText(message);
        return answer
            ? `收到，你写的是「${answer}」。我需要题目原文或关键条件才能核对；如果是口算、单词或公式，我会直接说对不对，再补一句检查点。`
            : '可以核对。把「题目 + 你写的答案」一起发来，我直接帮你确认，再补一句最容易错的检查点。';
    }
    if (step === 'fast_mode') {
        return `加速版：我只回三句。1. 先看「${misconception}」。2. 发题目和你当前答案。3. 我告诉你对不对、错在哪、下次先查什么。`;
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
    if (step === 'explain_full') {
        return `我可以讲透，但不替你抄完整作业。先把题目拆成三步：问什么、给了什么、该用什么方法。你先发「${selected}」的题目原文。`;
    }
    if (step === 'transfer') {
        return `现在做小变式。先别算到底：如果「${selected}」换一个条件，第一步还要检查什么？先说方法。`;
    }
    if (step === 'review') {
        return `复盘一句话：这类题下次先检查「${misconception}」，再动笔。把你的复盘句发来。`;
    }
    return `先锁定「${selected}」。它和「${misconception}」有关。先别算答案，用一句话说题目真正问什么。`;
}

function replyLooksLikeDirectAnswer(reply = '') {
    const text = String(reply || '');
    return /(?:最终答案|答案是|结果是|所以答案|因此答案|直接写|完整答案)[:：为\s]/.test(text)
        || /(?:^|\n)\s*(?:所以|因此)?\s*[A-D]\s*(?:$|\n)/.test(text)
        || /(?:^|\n).{0,16}=\s*-?\d+(?:\.\d+)?\s*(?:$|\n)/.test(text);
}

function sanitizeTutorReply(reply, message, context = {}, step = 'read_problem') {
    const answerCheckStep = step === 'check_answer' || step === 'fast_mode';
    const studentProvidedAnswer = Boolean(answerFromText(message));
    if (answerCheckStep && studentProvidedAnswer) {
        return { reply: clean(reply, 700), step, homeworkBoundary: false, sanitized: false };
    }
    if (!replyLooksLikeDirectAnswer(reply)) {
        return { reply: clean(reply, 700), step, homeworkBoundary: false, sanitized: false };
    }
    return {
        reply: localReply(message, context, 'write_first_step'),
        step: 'write_first_step',
        homeworkBoundary: true,
        sanitized: true
    };
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
            task_type: clean(selected.taskType || selected.task_type || '', 60),
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
        recent_messages: Array.isArray(context.recent_messages)
            ? context.recent_messages.slice(-6).map((item) => ({
                role: clean(item.role || '', 20) === 'assistant' ? 'assistant' : 'user',
                text: clean(item.text || '', 260)
            })).filter((item) => item.text)
            : [],
        coach_step: clean(context.coach_step || '', 40),
        help_mode: clean(context.help_mode || '', 40),
        parent_goal: normalizeParentGoal(context.parent_goal),
        homework_plan: context.homework_plan ? { present: true } : null
    };
}

function buildPrompt(mode, context = {}, step = 'read_problem', socraticRuntime = null) {
    const weak = (context.weak_points || [])
        .map((item) => `${item.name}:${item.reason || ''}`)
        .join('；') || '暂无雷达，先按审题和关键错因处理';
    const selected = context.selected_homework?.text || '未指定，默认从必须做第一项开始';
    const selectedReference = context.selected_homework?.reason || context.selected_homework?.evidence?.reason || '';
    const misconception = misconceptionText(context.selected_homework?.evidence?.misconception_tags || context.misconception_tags) || '待识别';
    const parentGoal = context.parent_goal
        ? `${context.parent_goal.label || context.parent_goal.id}：${context.parent_goal.strategy || '按家庭目标调整节奏'}`
        : '未设置，默认先讲懂再加练';
    const recentTurns = Array.isArray(context.recent_messages) && context.recent_messages.length
        ? context.recent_messages
            .slice(-5)
            .map((item) => `${item.role === 'assistant' ? 'AI' : 'student'}:${item.text}`)
            .join('\n')
        : 'none';
    const modeInstruction = {
        check_answer: '核对答案模式：如果学生已经给出自己的答案，可以直接判断对/不对或说明还缺哪条条件；不要绕回泛泛追问。回复控制在 3 句内。',
        fast_mode: '加速模式：必须三句内完成：结论、卡点、下一题检查点。不要展开长讲解。',
        explain_full: '讲透模式：可以分步骤讲清方法，但每一步后都要让学生接一句自己的理解，不给可直接抄写的整题答案。',
        transfer: '举一反三模式：不要重复原题答案，换一个小条件，检查方法能否迁移。',
        review: '复盘模式：逼近一句孩子能复述的话，下次先检查什么要具体。'
    }[step] || '默认模式：先问学生判断，再给最小提示。';
    const runtime = socraticRuntime || buildApiSocraticRuntime('', context, step);
    const runtimeLines = [
        `Socratic runtime: ${runtime.id}`,
        `Task type: ${runtime.taskType}`,
        `Misconception: ${runtime.misconception}`,
        `Round 1 ask: ${runtime.threeRoundProtocol[0].ask}`,
        `Round 2 ask: ${runtime.threeRoundProtocol[1].ask}`,
        `Round 3 ask: ${runtime.threeRoundProtocol[2].ask}`,
        `If still stuck: ${runtime.blackboardRecovery.childLine}`,
        `Transfer check: ${runtime.transferCheck.prompt}`,
        `Blocked moves: ${runtime.blockedMoves.join(', ')}`
    ].join('\n');
    return [
        '你是原点智学小程序里的原小点，面向小学高年级到初中学生。',
        '定位：快速定位薄弱点，给符合孩子当前认知的下一步；不做通用闲聊，不替孩子写作业。',
        '原则：简单题不绕，已做完可核对；没做完只给最小提示；连续学不懂时要讲清一个关键点，再让孩子复述。',
        '每次最多 120 字。不要暴露内部推理。不要承诺提分。',
        '如果学生没给自己的答案却要你代写，拒绝代写，并要求他说出第一步。',
        '如果材料足够，先定位关键错因，再给一个最小提示。',
        modeInstruction,
        `当前模式：${mode || 'homework'}`,
        `当前步骤：${COACH_STEPS[step]?.label || '读题'}`,
        `家庭目标：${parentGoal}`,
        `当前锁定作业：${selected}`,
        `可用核对依据：${selectedReference || '暂无，需学生补充题目/答案后再核对'}`,
        `当前弱点：${weak}`,
        `当前错因标签：${misconception}`,
        runtimeLines,
        `recent turns:\n${recentTurns}`
    ].join('\n');
}

function structuredReply(reply, mode, step, context = {}, extra = {}) {
    const selected = context.selected_homework || {};
    const tags = normalizeTags(
        (context.selected_homework?.evidence?.misconception_tags || []).concat(context.misconception_tags || [])
    );
    const primaryTag = tags[0]?.label || tags[0]?.axis || 'first_step';
    const diagnosticProbe = {
        axis: step,
        task_type: selected.task_type || 'unknown',
        focus: primaryTag,
        goal: COACH_STEPS[step]?.next_action || COACH_STEPS.read_problem.next_action,
        prompt: step === 'find_conditions'
            ? '先分开已知条件和要求什么。'
            : step === 'write_first_step'
                ? '只说第一步，不写完整答案。'
                : '先说题目真正问什么。',
        confidence: extra.extra && extra.extra.fallback === false ? 'model_supported' : 'local_guarded'
    };
    const socraticRuntime = extra.socraticRuntime || (extra.extra && extra.extra.socratic_runtime) || buildApiSocraticRuntime('', context, step);
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
        task_type: diagnosticProbe.task_type,
        diagnostic_probe: diagnosticProbe,
        socratic_runtime: socraticRuntime,
        three_round_protocol: socraticRuntime.threeRoundProtocol,
        blackboard_recovery: socraticRuntime.blackboardRecovery,
        transfer_check: socraticRuntime.transferCheck,
        next_review_route: socraticRuntime.transferCheck.route,
        engine_version: 'mini-tutor-message-v2.0',
        persisted: false,
        service_contract: {
            mode: extra.extra && extra.extra.fallback === false ? 'configured_model' : 'local_socratic_rules',
            evidence_required: ['student_first_step', 'selected_homework', 'misconception_tags'],
            boundary: 'no_direct_homework_answer'
        },
        model_contract: extra.extra && extra.extra.fallback === false ? {
            provider: 'deepseek',
            role: 'wording_rewrite_only',
            personalized_by: ['selected_homework', 'misconception_tags', 'coach_step']
        } : null,
        ...extra.extra
    };
}

async function replyWithTrace(req, session, input, payload, meta = {}) {
    const trace = {
        trace_id: safeId('trace'),
        session_id: clean(req.headers.get('x-mini-session') || '', 2048) || null,
        user_id: session.ok ? clean(session.payload?.user_id || '', 100) || null : null,
        child_id: session.ok ? clean(session.payload?.child_id || meta.child_id || '', 100) || null : clean(meta.child_id || '', 100) || null,
        endpoint: 'tutor-message',
        risk_type: clean(meta.risk_type || 'pass', 60),
        input_summary: clean(input, 220),
        output_summary: clean(payload?.reply || '', 260),
        blocked: Boolean(meta.blocked || payload?.homework_boundary || payload?.safety_blocked),
        sanitized: scrub({
            coach_step: payload?.coach_step || meta.coach_step || '',
            fallback: Boolean(payload?.fallback),
            output_sanitized: Boolean(payload?.output_sanitized)
        }),
        provider: clean(meta.provider || (payload?.fallback === false ? 'deepseek' : 'local_socratic_rules'), 80),
        created_at: nowIso()
    };
    const stored = await insertRows('mini_ai_traces', trace, 'return=minimal');
    return json({
        ...payload,
        trace_id: trace.trace_id,
        trace_persisted: Boolean(stored.ok),
        trace_warning: stored.ok ? '' : stored.error || ''
    });
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') {
        return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST' }, 405);
    }

    const limited = rateLimit(clientRateKey(req, 'mini:tutor'), 50);
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
    const socraticRuntime = buildApiSocraticRuntime(message, context, coachStep);

    const safety = riskyContent(message);
    const answerCheckStep = coachStep === 'check_answer' || coachStep === 'fast_mode';
    if (!safety.safe) {
        const step = safety.type === 'academic_integrity' && !answerCheckStep ? 'write_first_step' : coachStep;
        const payload = structuredReply(
            safety.type === 'self_harm' ? selfHarmReply() : localReply(message, context, step),
            mode,
            step,
            context,
            {
                homework_boundary: safety.type === 'academic_integrity' && !answerCheckStep,
                next_action: safety.type === 'academic_integrity' && !answerCheckStep
                    ? '先发自己的第一步或卡住的条件，我只给最小提示。'
                    : COACH_STEPS[step]?.next_action,
                socraticRuntime,
                extra: { safety_blocked: safety.type === 'self_harm' }
            }
        );
        return replyWithTrace(req, session, message, payload, { risk_type: safety.type, blocked: true, coach_step: step });
    }

    const key = env.deepseek();
    if (!key) {
        const payload = structuredReply(localReply(message, context, coachStep), mode, coachStep, context, {
            socraticRuntime,
            extra: { fallback: true, fallback_source: 'missing_model_key' }
        });
        return replyWithTrace(req, session, message, payload, { coach_step: coachStep, provider: 'local_socratic_rules' });
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TUTOR_UPSTREAM_TIMEOUT_MS);
        const upstream = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${key}`
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: 'deepseek-chat',
                temperature: 0.35,
                max_tokens: 260,
                stream: false,
                messages: [
                    { role: 'system', content: buildPrompt(mode, context, coachStep, socraticRuntime) },
                    { role: 'user', content: message }
                ]
            })
        });
        clearTimeout(timeout);

        if (!upstream.ok) {
            const payload = structuredReply(localReply(message, context, coachStep), mode, coachStep, context, {
                socraticRuntime,
                extra: { fallback: true, fallback_source: 'server_upstream_error', upstream_status: upstream.status }
            });
            return replyWithTrace(req, session, message, payload, { coach_step: coachStep, provider: 'local_socratic_rules' });
        }

        const data = await upstream.json();
        const rawReply = clean(data.choices?.[0]?.message?.content || '', 600) || localReply(message, context, coachStep);
        const safeReply = sanitizeTutorReply(rawReply, message, context, coachStep);
        const successPayload = structuredReply(safeReply.reply, mode, safeReply.step, context, {
            homework_boundary: safeReply.homeworkBoundary,
            next_action: safeReply.homeworkBoundary ? '先发自己的第一步或卡住的条件，我只给最小提示。' : undefined,
            socraticRuntime: safeReply.step === coachStep ? socraticRuntime : buildApiSocraticRuntime(message, context, safeReply.step),
            extra: { fallback: false, output_sanitized: safeReply.sanitized, upstream_status: upstream.status }
        });
        return replyWithTrace(req, session, message, successPayload, { coach_step: safeReply.step, provider: 'deepseek' });
    } catch (error) {
        const errorPayload = structuredReply(localReply(message, context, coachStep), mode, coachStep, context, {
            socraticRuntime,
            extra: {
                fallback: true,
                fallback_source: error && error.name === 'AbortError' ? 'upstream_timeout' : 'server_upstream_error'
            }
        });
        return replyWithTrace(req, session, message, errorPayload, { coach_step: coachStep, provider: 'local_socratic_rules' });
    }
}
