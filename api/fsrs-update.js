// 原点智学 · FSRS-4.5 state 更新端点
// POST /api/fsrs-update
// Body: { student_id, knowledge_point_id, is_correct, time_spent_ms?, hint_level? }
// → { ok, fsrs_state, next_due_at }
//
// 调用时机：mastery-loop 每答完一题，并行调 ingest-attempt + fsrs-update
// 服务端做：① 拉旧 fsrs_state ② 推一次 fsrs.update（FSRS-4.5 完整公式） ③ UPSERT 回 student_states
//
// 用 service_role 因为要 UPSERT student_states（anon RLS 没开 INSERT/UPDATE 这表）
//
// FSRS-4.5 核心三参数：
//   stability(S)        记忆强度 · 单位天 · retrievability=90% 时的间隔天数
//   difficulty(D)       题目对该学生的主观难度 [1, 10]
//   retrievability(R)   当前回忆概率 · R = (1 + t/(9*S))^(-1)（FSRS-4.5 power-law decay）
//
// 17 参数 w0..w16 见 ./_fsrs-weights.json，论文经验值，按学生 fine-tune 后覆盖
//
// 复习成功核心增益公式（rating ∈ {2,3,4}）：
//   alpha = exp(w8) * (11 - D)^(-w9) * ((S+1)^w10 - 1) * exp((1-R) * w11)
//   S' = S * (1 + alpha * hard_penalty * easy_bonus)
//
// 复习失败 lapse 公式（rating=1）：
//   S' = w11 * D^(-w12) * ((S+1)^w13 - 1) * exp(w14 * (1 - R))
//
// 难度更新（mean reversion，FSRS-4.5 修正项）：
//   D' = w7 * init_D(rating=4) + (1 - w7) * (D - w6 * (rating - 3))
//
// 下次复习 interval（target retention 90%）：
//   I = (9 * S) * (R_target^(-1) - 1)  ≈ S 当 R_target=0.9
//   FSRS-4.5 标准：I = (S / FACTOR) * (R_target^(1/DECAY) - 1)，FACTOR=DECAY=-0.5

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const ENGINE_VERSION = 'fsrs-update-v2.0-fsrs45';

// FSRS-4.5 默认 17 参数（与 _fsrs-weights.json 同步）
const W = [
    0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234,
    1.616, 0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466
];
const TARGET_RETENTION = 0.9;
// FSRS-4.5 / 5 power-law decay 常量
//   DECAY = -0.5
//   FACTOR = 0.9^(1/DECAY) - 1 = 19/81 ≈ 0.234567，让 R(S,S)=0.9
const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY_MS = 86400000;

const GRADE = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// FSRS-4.5 retrievability：power-law 衰减
// R(t, S) = (1 + FACTOR * t / S)^DECAY，FACTOR=DECAY=-0.5 → R = (1 + t/(9S))^(-1) 等价
function calcRetrievability(stability, days) {
    if (days <= 0) return 1.0;
    const s = Math.max(0.1, stability);
    return Math.pow(1 + FACTOR * days / s, DECAY);
}

// FSRS-4.5 next interval：根据 target retention 反解 t
// I = (S / FACTOR) * (R_target^(1/DECAY) - 1)
function calcDueAt(lastReviewAt, stability) {
    const interval = (stability / FACTOR) * (Math.pow(TARGET_RETENTION, 1 / DECAY) - 1);
    return lastReviewAt + clamp(interval, 0.5, 36500) * DAY_MS;
}

// 初始 stability：首次复习按 rating 取 w0..w3
function initStability(rating) {
    return clamp(W[rating - 1], 0.1, 365);
}

// 初始 difficulty：首次复习 D = w4 - exp(w5 * (rating - 1)) + 1
function initDifficulty(rating) {
    return clamp(W[4] - Math.exp(W[5] * (rating - 1)) + 1, 1, 10);
}

// 难度更新（FSRS-4.5 mean reversion）：
// D_new = D_target = D - w6 * (rating - 3)
// D' = w7 * initDifficulty(4) + (1 - w7) * D_new
function nextDifficulty(D, rating) {
    const dTarget = D - W[6] * (rating - 3);
    const reverted = W[7] * initDifficulty(4) + (1 - W[7]) * dTarget;
    return clamp(reverted, 1, 10);
}

// 复习成功 stability 增益（rating ∈ {Hard, Good, Easy}）
// S' = S * (1 + alpha * hardPenalty * easyBonus)
function nextRecallStability(D, S, R, rating) {
    const hardPenalty = rating === GRADE.HARD ? W[15] : 1;
    const easyBonus = rating === GRADE.EASY ? W[16] : 1;
    const alpha = Math.exp(W[8])
        * (11 - D)
        * Math.pow(S, -W[9])
        * (Math.exp((1 - R) * W[10]) - 1);
    return clamp(S * (1 + alpha * hardPenalty * easyBonus), 0.1, 36500);
}

// 复习失败 lapse stability：
// S' = w11 * D^(-w12) * ((S+1)^w13 - 1) * exp(w14 * (1 - R))
function nextForgetStability(D, S, R) {
    const lapse = W[11]
        * Math.pow(D, -W[12])
        * (Math.pow(S + 1, W[13]) - 1)
        * Math.exp(W[14] * (1 - R));
    return clamp(lapse, 0.1, 36500);
}

function inferGrade(isCorrect, timeMs, hintLevel) {
    if (!isCorrect) return GRADE.AGAIN;
    if (hintLevel === 'strong' || hintLevel === 'reveal') return GRADE.HARD;
    if (timeMs && timeMs > 90000) return GRADE.HARD;
    if (timeMs && timeMs < 30000 && (!hintLevel || hintLevel === 'none')) return GRADE.EASY;
    return GRADE.GOOD;
}

function fsrsUpdate(prev, grade, reviewAt) {
    // 首次复习：用 init 公式初始化 S/D
    if (!prev || prev.stability == null || prev.difficulty == null) {
        const stability = initStability(grade);
        const difficulty = initDifficulty(grade);
        return {
            stability: Math.round(stability * 1000) / 1000,
            difficulty: Math.round(difficulty * 1000) / 1000,
            retrievability: 1.0,
            retrievability_at_last_review: 1.0,
            last_review_at: reviewAt,
            due_at: calcDueAt(reviewAt, stability),
            reps: 1,
            lapses: grade === GRADE.AGAIN ? 1 : 0,
            state: grade === GRADE.AGAIN ? 'learning' : 'review',
        };
    }

    const days = Math.max(0, (reviewAt - prev.last_review_at) / DAY_MS);
    const R = calcRetrievability(prev.stability, days);
    const D = clamp(prev.difficulty, 1, 10);
    const S = clamp(prev.stability, 0.1, 36500);
    let reps = (prev.reps || 0);
    let lapses = (prev.lapses || 0);
    let newS, newD, state;

    if (grade === GRADE.AGAIN) {
        newS = nextForgetStability(D, S, R);
        newD = nextDifficulty(D, grade);
        lapses += 1;
        state = 'relearning';
    } else {
        newS = nextRecallStability(D, S, R, grade);
        newD = nextDifficulty(D, grade);
        state = 'review';
    }
    reps += 1;

    return {
        stability: Math.round(newS * 1000) / 1000,
        difficulty: Math.round(newD * 1000) / 1000,
        retrievability: Math.round(R * 1000) / 1000,
        retrievability_at_last_review: Math.round(R * 1000) / 1000,
        last_review_at: reviewAt,
        due_at: calcDueAt(reviewAt, newS),
        reps,
        lapses,
        state,
    };
}

function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ ok: false, error: code, message: msg }), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

async function pgFetch(path, opts = {}) {
    return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        ...opts,
        headers: {
            ...(opts.headers || {}),
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
        },
    });
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    if (req.method !== 'POST') return jsonErr(405, 'method_not_allowed', '只接受 POST');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return jsonErr(503, 'not_configured', 'Supabase service_role env 未配');
    }

    let body;
    try { body = await req.json(); }
    catch (e) { return jsonErr(400, 'bad_json', '请求体不是合法 JSON'); }

    const { student_id, knowledge_point_id: rawKpId, knowledge_point_code, is_correct, time_spent_ms, hint_level, mastery_score } = body || {};
    if (!student_id || (!rawKpId && !knowledge_point_code) || typeof is_correct !== 'boolean') {
        return jsonErr(400, 'missing_fields', 'student_id + (knowledge_point_id 或 knowledge_point_code) + is_correct 必填');
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(student_id)) return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');
    if (rawKpId && !UUID_RE.test(rawKpId)) return jsonErr(400, 'bad_kp_id', 'knowledge_point_id 必须是 UUID（前端建议传 knowledge_point_code 让后端 lookup）');

    // code → UUID 桥接（mastery-loop 前端只有 code 字符串）
    let knowledge_point_id = rawKpId;
    if (!knowledge_point_id && knowledge_point_code) {
        const lookupR = await pgFetch(`/knowledge_points?code=eq.${encodeURIComponent(knowledge_point_code)}&select=id`);
        if (!lookupR.ok) return jsonErr(502, 'kp_lookup_failed', '知识点 code 查询失败');
        const found = await lookupR.json();
        if (!found.length) {
            return jsonErr(404, 'kp_code_not_found', `code=${knowledge_point_code} 不在 knowledge_points 表（先跑 seed 脚本）`);
        }
        knowledge_point_id = found[0].id;
    }

    // 1. 拉旧 state
    const r1 = await pgFetch(
        `/student_states?student_id=eq.${student_id}&knowledge_point_id=eq.${knowledge_point_id}&select=fsrs_state,attempts_count,correct_count,mastery_score`
    );
    if (!r1.ok) return jsonErr(502, 'db_read_failed', await r1.text().then(t => t.slice(0, 200)));
    const existing = await r1.json();
    const prev = existing[0]?.fsrs_state || null;
    const prevAttempts = existing[0]?.attempts_count || 0;
    const prevCorrect = existing[0]?.correct_count || 0;
    const prevMastery = existing[0]?.mastery_score ?? 0.3;

    // 2. 算新 state
    const grade = inferGrade(is_correct, time_spent_ms, hint_level);
    const now = Date.now();
    const newState = fsrsUpdate(prev, grade, now);

    // 3. UPSERT 回 student_states
    const newRow = {
        student_id,
        knowledge_point_id,
        mastery_score: typeof mastery_score === 'number' ? mastery_score : prevMastery,
        attempts_count: prevAttempts + 1,
        correct_count: prevCorrect + (is_correct ? 1 : 0),
        fsrs_state: newState,
        last_practiced_at: new Date(now).toISOString(),
        next_review_at: new Date(newState.due_at).toISOString(),
        model_name: 'fsrs',
        model_version: ENGINE_VERSION,
        updated_at: new Date(now).toISOString(),
    };

    const r2 = await pgFetch(`/student_states?on_conflict=student_id,knowledge_point_id`, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(newRow),
    });
    if (!r2.ok) {
        const t = await r2.text();
        return jsonErr(502, 'db_upsert_failed', `Supabase ${r2.status}: ${t.slice(0, 200)}`);
    }

    return new Response(JSON.stringify({
        ok: true,
        student_id,
        knowledge_point_id,
        grade_inferred: grade,
        fsrs_state: newState,
        next_due_at: new Date(newState.due_at).toISOString(),
        days_until_next_review: Math.round((newState.due_at - now) / DAY_MS * 10) / 10,
        engine_version: ENGINE_VERSION,
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}
