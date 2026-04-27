// 原点智学 · FSRS state 更新端点
// POST /api/fsrs-update
// Body: { student_id, knowledge_point_id, is_correct, time_spent_ms?, hint_level? }
// → { ok, fsrs_state, next_due_at }
//
// 调用时机：mastery-loop 每答完一题，并行调 ingest-attempt + fsrs-update
// 服务端做：① 拉旧 fsrs_state ② 推一次 fsrs.update ③ UPSERT 回 student_states
//
// 用 service_role 因为要 UPSERT student_states（anon RLS 没开 INSERT/UPDATE 这表）

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const ENGINE_VERSION = 'fsrs-update-v1.0';

// FSRS 9 参数（默认）
const W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49];
const TARGET_RETENTION = 0.9;
const DAY_MS = 86400000;

const GRADE = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function calcRetrievability(stability, days) {
    if (days <= 0) return 1.0;
    return Math.pow(0.9, days / Math.max(0.1, stability));
}
function calcDueAt(lastReviewAt, stability) {
    const interval = stability * Math.log(TARGET_RETENTION) / Math.log(0.9);
    return lastReviewAt + clamp(interval, 0.5, 365) * DAY_MS;
}

function inferGrade(isCorrect, timeMs, hintLevel) {
    if (!isCorrect) return GRADE.AGAIN;
    if (hintLevel === 'strong' || hintLevel === 'reveal') return GRADE.HARD;
    if (timeMs && timeMs > 90000) return GRADE.HARD;
    if (timeMs && timeMs < 30000 && (!hintLevel || hintLevel === 'none')) return GRADE.EASY;
    return GRADE.GOOD;
}

function fsrsUpdate(prev, grade, reviewAt) {
    if (!prev) {
        const stability = grade === GRADE.AGAIN ? W[0] : grade === GRADE.HARD ? W[1] : grade === GRADE.GOOD ? W[2] : W[3];
        const difficulty = clamp(W[4] - (grade - 3) * 1.0, 1, 10);
        return {
            stability, difficulty, retrievability: 1.0,
            last_review_at: reviewAt,
            due_at: reviewAt + clamp(stability, 0.5, 365) * DAY_MS,
            reps: 1, lapses: grade === GRADE.AGAIN ? 1 : 0,
            state: grade === GRADE.AGAIN ? 'learning' : 'review',
        };
    }
    const days = Math.max(0, (reviewAt - prev.last_review_at) / DAY_MS);
    const r = calcRetrievability(prev.stability, days);
    let { stability, difficulty, reps, lapses, state } = prev;

    if (grade === GRADE.AGAIN) {
        stability = clamp(W[0] + 0.1 * stability, 0.1, 365);
        difficulty = clamp(difficulty + W[5] * 1.5, 1, 10);
        lapses += 1; state = 'relearning';
    } else {
        const factor = grade === GRADE.HARD ? W[8] : grade === GRADE.GOOD ? 1.0 : 1.3;
        const inc = Math.exp(W[6]) * factor *
                    Math.pow(11 - difficulty, -W[7]) *
                    (1 + Math.exp(-r) * 0.5);
        stability = clamp(stability * inc, 0.5, 365);
        difficulty = clamp(difficulty - (grade - 3) * 0.3, 1, 10);
        state = 'review';
    }
    reps += 1;
    return {
        stability: Math.round(stability * 1000) / 1000,
        difficulty: Math.round(difficulty * 1000) / 1000,
        retrievability: Math.round(r * 1000) / 1000,
        last_review_at: reviewAt,
        due_at: calcDueAt(reviewAt, stability),
        reps, lapses, state,
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
