// 原点智学 · 对话日志写库端点
// POST { student_id, role, content, kind, meta? }
//   role: 'student' | 'tutor' | 'system'
//   kind: 'chat' | 'diagnose_call' | 'retrieve_call' | 'hint_request'
// → { ok: true, dialogue_id }
//
// 用途：
//   1. mastery-loop / 未来 chat UI 每一句话都打这里（学生 + tutor 双向）
//   2. /api/diagnose 调用日志（kind=diagnose_call，meta=完整 LLM 入参/出参）
//   3. /api/retrieve 调用日志（kind=retrieve_call）
//   4. 未来训 NCDM / 蒸馏自家中文 K12 苏格拉底模型的金矿数据

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) : '';
const ENGINE_VERSION = 'log-dialogue-v1.0';

// 与 0001 schema dialogue_role_enum 对齐
const ALLOWED_ROLES = new Set(['student', 'tutor', 'system', 'tool']);
const ALLOWED_KINDS = new Set(['chat', 'diagnose_call', 'retrieve_call', 'hint_request', 'mastery_event']);

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
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return jsonErr(503, 'not_configured', 'Supabase env 未配');

    let body;
    try { body = await req.json(); }
    catch (e) { return jsonErr(400, 'bad_json', '请求体不是合法 JSON'); }

    const { student_id, role, content, kind, meta, question_id, topic_id, attempt_id, session_id, turn_index, model_name } = body || {};
    if (!student_id || !role || content == null) return jsonErr(400, 'missing_fields', 'student_id + role + content 必填');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(student_id)) {
        return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');
    }
    if (!ALLOWED_ROLES.has(role)) return jsonErr(400, 'bad_role', `role 必须是 ${[...ALLOWED_ROLES].join('|')}`);
    if (kind && !ALLOWED_KINDS.has(kind)) return jsonErr(400, 'bad_kind', `kind 必须是 ${[...ALLOWED_KINDS].join('|')}`);

    // 把 topic_id 装进 meta（0001 dialogues 表无 topic_id 列）
    const enrichedMeta = { ...(meta || {}) };
    if (topic_id) enrichedMeta.topic_id = topic_id;

    // session_id 缺失时端点生成（0004 已设 default gen_random_uuid，但前端传清晰更可读）
    const sid = session_id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null);

    // 同 ingest-attempt：UUID 校验避免 'fb1' 这种 fallback id 触发 22P02
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safe_qid = (typeof question_id === 'string' && UUID_RE.test(question_id)) ? question_id : null;
    const safe_aid = (typeof attempt_id === 'string' && UUID_RE.test(attempt_id)) ? attempt_id : null;

    const row = {
        student_id,
        session_id: sid,
        role,
        kind: kind || 'chat',
        content: String(content).slice(0, 5000),
        meta: enrichedMeta,                                  // 0004 加的字段
        question_id: safe_qid,
        attempt_id: safe_aid,
        turn_index: typeof turn_index === 'number' ? turn_index : 0,
        model_name: model_name || null,
        created_at: new Date().toISOString(),
    };

    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/dialogues`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                // return=minimal 绕开 SELECT RLS（dialogues 表 anon 没 SELECT policy）
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
