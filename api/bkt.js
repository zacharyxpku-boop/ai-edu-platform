// 原点智学 · 自研 BKT 知识追踪引擎 + IRT-2PL 难度调整层
// POST { current_mastery?, attempts:[{is_correct, difficulty?, discrimination?, time_spent_ms?}], params? }
// → { mastery_trace[], final_mastery, mastered, steps_to_mastery, engine_version }
//
// BKT 标准四参数（OATutor BKT-brain.js 同源公式）：
//   P(L0) prior   - 起步掌握度，默认 0.3
//   P(T)  learn   - 每练一题真学到的概率，默认 0.15
//   P(G)  guess   - 没掌握却蒙对的概率，默认 0.2
//   P(S)  slip    - 掌握了却答错的概率，默认 0.1
//
// IRT-2PL 调整层（v2.0 加）：
//   每道题除 difficulty(b) 外另带 discrimination(a)
//   P(correct | mastery, b, a) = 1 / (1 + exp(-1.7 * a * (mastery - b)))
//   惊讶度 = |实际表现 - IRT 预期|
//   - 做对了 IRT 预期会做对的题 → mastery 微调升 (+0.05)
//   - 做对了 IRT 预期会做错的题 → mastery 大升   (+0.15)
//   - 做错了 IRT 预期会做对的题 → mastery 大降   (-0.15)
//   - 做错了 IRT 预期会做错的题 → mastery 微降   (-0.05)
//
// 改造点：
//   1. difficulty bonus  难题答对 boost guess 折扣，简单题答错折扣 slip
//   2. timeout slip      答对但超时的，slip 调高避免蒙混当真会
//   3. IRT 惊讶度调整    BKT 后再叠 ±0.05~±0.15
//   4. mastered 阈值 0.9  Khan Academy mastery learning 行业标准
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
const ENGINE_VERSION = 'bkt-v2.0-irt2pl';

// IRT-2PL 调整幅度
const IRT_ADJUST = {
    SURPRISE_LOW: 0.05,   // 表现符合预期 → 微调
    SURPRISE_HIGH: 0.15,  // 表现违反预期 → 大调
    SURPRISE_THRESHOLD: 0.5  // |实际-预期| > 0.5 视为高惊讶
};
// 区分度默认值（每道题独立 a 参数，缺省 1.0）
const DEFAULT_DISCRIMINATION = 1.0;

// IRT-2PL 概率函数：P(correct | θ=mastery, a=discrimination, b=difficulty)
// 1.7 是常数 D，让 logistic 逼近正态 ogive
function irt2plProb(mastery, difficulty, discrimination) {
    const theta = mastery;
    const a = discrimination != null ? discrimination : DEFAULT_DISCRIMINATION;
    const b = difficulty != null ? difficulty : 0.5;
    const z = -1.7 * a * (theta - b);
    return 1 / (1 + Math.exp(z));
}

// IRT 惊讶度调整：实际表现 vs IRT 预期，叠加在 BKT mastery 之上
function irtSurpriseAdjust(mastery, isCorrect, difficulty, discrimination) {
    const expected = irt2plProb(mastery, difficulty, discrimination);  // 0~1
    const actual = isCorrect ? 1 : 0;
    const surprise = actual - expected;  // 正：超预期；负：低于预期
    const absSurprise = Math.abs(surprise);
    const magnitude = absSurprise > IRT_ADJUST.SURPRISE_THRESHOLD
        ? IRT_ADJUST.SURPRISE_HIGH
        : IRT_ADJUST.SURPRISE_LOW;
    // surprise 同号注入：做对超预期 → +；做错低于预期 → -
    const delta = Math.sign(surprise) * magnitude;
    return delta;
}

// 单步 BKT 后验更新 + IRT-2PL 惊讶度叠加
function updateMastery(prior, isCorrect, difficulty, discrimination, timeMs, baseParams) {
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
    const bktNext = posterior + (1 - posterior) * learn;

    // IRT-2PL 惊讶度调整 —— 在 BKT 输出基础上叠加 ±0.05~±0.15
    // 用 prior（updateMastery 入口的 mastery）算预期，反映该生「当下能力 vs 题目难度」
    const irtDelta = irtSurpriseAdjust(prior, isCorrect, difficulty, discrimination);
    const next = bktNext + irtDelta;

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
        const masteryBefore = mastery;
        const irtExpected = irt2plProb(masteryBefore, a.difficulty, a.discrimination);
        mastery = updateMastery(masteryBefore, a.is_correct, a.difficulty, a.discrimination, a.time_spent_ms, params);
        trace.push({
            step: i + 1,
            mastery: Math.round(mastery * 1000) / 1000,
            attempt: {
                is_correct: a.is_correct,
                difficulty: a.difficulty != null ? a.difficulty : null,
                discrimination: a.discrimination != null ? a.discrimination : DEFAULT_DISCRIMINATION,
                time_spent_ms: a.time_spent_ms != null ? a.time_spent_ms : null,
                irt_expected_p: Math.round(irtExpected * 1000) / 1000
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
