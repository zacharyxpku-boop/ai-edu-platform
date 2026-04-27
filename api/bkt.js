// 原点智学 · 自研 BKT 知识追踪引擎
// POST { current_mastery?, attempts:[{is_correct, difficulty?, time_spent_ms?}], params? }
// → { mastery_trace[], final_mastery, mastered, steps_to_mastery, engine_version }
//
// BKT 标准四参数（OATutor BKT-brain.js 同源公式）：
//   P(L0) prior   - 起步掌握度，默认 0.3
//   P(T)  learn   - 每练一题真学到的概率，默认 0.15
//   P(G)  guess   - 没掌握却蒙对的概率，默认 0.2
//   P(S)  slip    - 掌握了却答错的概率，默认 0.1
//
// 改造点（Agent 4 实测后选型）：
//   1. difficulty bonus  难题答对 boost，简单题答错放大 slip
//   2. timeout slip      答对但超时的，slip 调高避免蒙混当真会
//   3. mastered 阈值 0.9  Khan Academy mastery learning 行业标准
//
// 性能：纯函数 + Edge runtime，<1ms 完成 30 题序列
// 调用：fetch('/api/bkt', { method:'POST', body: JSON.stringify({...}) })

export const config = { runtime: 'edge' };

const DEFAULT_PARAMS = {
    prior: 0.3,
    learn: 0.15,
    guess: 0.2,
    slip: 0.1
};
const MASTERY_THRESHOLD = 0.9;
const ENGINE_VERSION = 'bkt-v1.0-difficulty-aware';

// 单步 BKT 后验更新
function updateMastery(prior, isCorrect, difficulty, timeMs, baseParams) {
    let { learn, guess, slip } = baseParams;

    // difficulty 取 [0,1]，0=简单 1=难，缺省 0.5
    const d = Math.max(0, Math.min(1, difficulty != null ? difficulty : 0.5));

    // 难题答对：蒙对的概率应该更小
    // 难题答错：不一定是 slip，可能是真不会，slip 折扣
    if (isCorrect) {
        guess = guess * (1 - 0.5 * d);
    } else {
        slip = slip * (1 - 0.5 * d);
    }

    // 超时 slip：超过 60s 才答对的，slip 抬高
    if (isCorrect && timeMs && timeMs > 60000) {
        const overtime = Math.min(1, (timeMs - 60000) / 60000);
        slip = Math.min(0.5, slip + overtime * 0.1);
    }

    // BKT 标准后验
    let posterior;
    if (isCorrect) {
        const numer = prior * (1 - slip);
        const denom = prior * (1 - slip) + (1 - prior) * guess;
        posterior = denom > 0 ? numer / denom : prior;
    } else {
        const numer = prior * slip;
        const denom = prior * slip + (1 - prior) * (1 - guess);
        posterior = denom > 0 ? numer / denom : prior;
    }

    // 学习转移：未掌握状态有 P(T) 概率本次学到
    const next = posterior + (1 - posterior) * learn;
    return Math.max(0, Math.min(1, next));
}

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'POST only' }), {
            status: 405, headers: { 'Content-Type': 'application/json' }
        });
    }
    let body;
    try { body = await req.json(); }
    catch (e) {
        return new Response(JSON.stringify({ error: 'invalid json' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    const { current_mastery, attempts, params: userParams } = body || {};

    if (!Array.isArray(attempts)) {
        return new Response(JSON.stringify({ error: 'attempts must be an array' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }
    if (attempts.length > 200) {
        return new Response(JSON.stringify({ error: 'attempts too many (max 200)' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    const params = { ...DEFAULT_PARAMS, ...(userParams || {}) };
    let mastery = current_mastery != null ? current_mastery : params.prior;
    mastery = Math.max(0, Math.min(1, mastery));

    const trace = [{ step: 0, mastery: Math.round(mastery * 1000) / 1000, attempt: null }];
    let stepsToMastery = null;

    for (let i = 0; i < attempts.length; i++) {
        const a = attempts[i] || {};
        if (typeof a.is_correct !== 'boolean') continue;
        mastery = updateMastery(mastery, a.is_correct, a.difficulty, a.time_spent_ms, params);
        trace.push({
            step: i + 1,
            mastery: Math.round(mastery * 1000) / 1000,
            attempt: {
                is_correct: a.is_correct,
                difficulty: a.difficulty != null ? a.difficulty : null,
                time_spent_ms: a.time_spent_ms != null ? a.time_spent_ms : null
            }
        });
        if (mastery >= MASTERY_THRESHOLD && stepsToMastery === null) {
            stepsToMastery = i + 1;
        }
    }

    return new Response(JSON.stringify({
        mastery_trace: trace,
        final_mastery: Math.round(mastery * 1000) / 1000,
        mastered: mastery >= MASTERY_THRESHOLD,
        mastery_threshold: MASTERY_THRESHOLD,
        steps_to_mastery: stepsToMastery,
        params_used: params,
        engine_version: ENGINE_VERSION
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
}
