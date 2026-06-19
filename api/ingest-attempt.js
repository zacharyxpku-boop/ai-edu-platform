// 原点智学 · 答题日志写库端点
// POST { student_id, question_id?, question_stem?, topic_id?, is_correct, response, time_spent_ms, difficulty?, hint_level?, mastery_after? }
// → { ok: true, attempt_id }
//
// 调用：mastery-loop.html 提交答题后调用，让 attempts 表实时填充
// 数据流向：服务端 service_role 写入 attempts → NCDM 夜间训练拉这些数据

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

const ENGINE_VERSION = 'ingest-attempt-v1.0';

// 简单 IP 限流，防刷
const ipBucket = new Map();
const IP_LIMIT_PER_MIN = 60;

function ratelimit(ip) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const k = ip + '|' + minute;
    const n = (ipBucket.get(k) || 0) + 1;
    ipBucket.set(k, n);
    if (ipBucket.size > 5000) {
        for (const key of ipBucket.keys()) {
            const m = parseInt(key.split('|')[1], 10);
            if (m < minute - 1) ipBucket.delete(key);
        }
    }
    return n <= IP_LIMIT_PER_MIN;
}

function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ ok: false, error: code, message: msg }), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'POST, OPTIONS',
                'access-control-allow-headers': 'content-type'
            }
        });
    }
    if (req.method !== 'POST') return jsonErr(405, 'method_not_allowed', '只接受 POST');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return jsonErr(503, 'not_configured', 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 未配置');
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip') || 'unknown';
    if (!ratelimit(ip)) return jsonErr(429, 'rate_limited', '答题频率过快');

    let body;
    try { body = await req.json(); }
    catch (e) { return jsonErr(400, 'bad_json', '请求体不是合法 JSON'); }

    const {
        student_id, question_id, question_stem, topic_id, topic_code,
        is_correct, response, time_spent_ms,
        difficulty, hint_level, mastery_before, mastery_after,
        diagnose_l3, session_id
    } = body || {};

    if (!student_id || typeof is_correct !== 'boolean' || response == null) {
        return jsonErr(400, 'missing_fields', 'student_id + is_correct + response 必填');
    }
    // student_id UUID 校验（避免 22P02 静默失败）
    const STUDENT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!STUDENT_UUID_RE.test(student_id)) return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');

    // 0001 schema 严格校验：hint_level 必须是 enum 值
    const VALID_HINT_LEVELS = new Set(['none', 'light', 'medium', 'strong', 'reveal']);
    const hl = hint_level && VALID_HINT_LEVELS.has(hint_level) ? hint_level : 'none';

    // 扩展字段（mastery / diagnose / difficulty / question_stem）放进 scored_meta jsonb
    const scored_meta = {};
    if (typeof mastery_before === 'number') scored_meta.mastery_before = Math.max(0, Math.min(1, mastery_before));
    if (typeof mastery_after === 'number') scored_meta.mastery_after = Math.max(0, Math.min(1, mastery_after));
    if (Array.isArray(diagnose_l3) && diagnose_l3.length) scored_meta.diagnose_l3 = diagnose_l3.slice(0, 5);
    if (typeof difficulty === 'number') scored_meta.difficulty = Math.max(0, Math.min(1, difficulty));
    scored_meta.scored_by = 'rule';

    // 临时题（不在 questions 表）的题面快照
    const question_snapshot = question_stem ? { stem: String(question_stem).slice(0, 1000), topic_id: topic_id || null } : null;

    // question_id 必须是合法 UUID（mastery-loop fallback 题 id 是 'fb1' 非 UUID，原样发会触发 22P02）
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safe_question_id = (typeof question_id === 'string' && UUID_RE.test(question_id)) ? question_id : null;

    const row = {
        student_id,
        question_id: safe_question_id,                       // 非 UUID 强制 null 避免 invalid uuid syntax
        session_id: session_id || null,                     // 可空
        response: String(response).slice(0, 2000),
        is_correct,
        time_spent_ms: typeof time_spent_ms === 'number' ? Math.round(time_spent_ms) : null,
        hint_level: hl,
        topic_code: topic_code || topic_id || null,         // 兼容 demo 期前端传 topic_id
        question_snapshot,
        scored_meta,
        submitted_at: new Date().toISOString(),
    };

    // 服务端走 PostgREST；前端不接触数据库密钥，RLS 下由 service_role 写入。
    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/attempts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
                // 前端 fire-and-forget 不需要 attempt_id，只需要 200/2xx 状态
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify(row),
        });
        if (!r.ok) {
            const text = await r.text();
            return jsonErr(502, 'db_insert_failed', `Supabase ${r.status}: ${text.slice(0, 200)}`);
        }
        return new Response(JSON.stringify({
            ok: true,
            engine_version: ENGINE_VERSION,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        });
    } catch (e) {
        return jsonErr(502, 'upstream_unreachable', `Supabase 不可达: ${e.message}`);
    }
}
