// 原点智学 · /api/mentor-queue · 学长接班看板
//
// GET ?status=pending|claimed|resolved&limit=50 · 列 escalation 队列
// GET ?id=<uuid> · 取单条详情（含完整 dossier 学情档案）
// POST { action:'claim', id, mentor_name }     · 学长认领
// POST { action:'resolve', id, resolution_kind, resolution_content } · 完成回复
//
// 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md 三圈层 §6
// 配套：mentor.html 极简看板页

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KIND_LABEL = {
    concept: '概念', emotion: '情绪', streak_3_wrong: '同型连错', planning: '规划', manual: '直接呼叫',
};
const KIND_EMOJI = { concept:'🧠', emotion:'💙', streak_3_wrong:'🔁', planning:'🗺️', manual:'✋' };

function jsonResp(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',  // queue 实时性优先，不 cache
            'Access-Control-Allow-Origin': '*',
        },
    });
}
function jsonErr(status, code, msg) { return jsonResp({ ok: false, error: code, message: msg }, status); }

async function pgFetch(path, opts = {}) {
    return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        ...opts,
        headers: {
            ...(opts.headers || {}),
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    });
}

function fmtRel(iso) {
    if (!iso) return null;
    const diff = (Date.now() - new Date(iso).getTime()) / 60000;
    if (diff < 1) return '刚刚';
    if (diff < 60) return `${Math.round(diff)} 分钟前`;
    if (diff < 1440) return `${Math.round(diff / 60)} 小时前`;
    return `${Math.round(diff / 1440)} 天前`;
}

// 紧迫度标记：基于 priority + 已等多久 + ETA
function urgencyOf(esc) {
    const waitedMin = (Date.now() - new Date(esc.created_at).getTime()) / 60000;
    const eta = esc.expected_response_minutes || 30;
    const ratio = waitedMin / eta;
    if (esc.priority === 1) return 'critical';     // 情绪危机优先
    if (ratio >= 0.8) return 'urgent';             // 接近 SLA
    if (ratio >= 0.5) return 'warning';
    return 'normal';
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'content-type',
            },
        });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return jsonErr(503, 'not_configured', 'SUPABASE env');

    if (req.method === 'GET') return handleGet(req);
    if (req.method === 'POST') return handlePost(req);
    return jsonErr(405, 'method_not_allowed', 'GET or POST');
}

async function handleGet(req) {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    // 单条详情
    if (id) {
        if (!UUID_RE.test(id)) return jsonErr(400, 'bad_id', 'id 必须是 UUID');
        const r = await pgFetch(`/escalations?id=eq.${id}&select=*,students!inner(name,grade,id)&limit=1`);
        if (!r.ok) return jsonErr(502, 'pg_fetch_failed', `${r.status}`);
        const arr = await r.json();
        if (!arr.length) return jsonErr(404, 'not_found', 'escalation 不存在');
        const esc = arr[0];
        return jsonResp({
            ok: true,
            escalation: {
                id: esc.id,
                kind: esc.kind,
                kind_label: KIND_LABEL[esc.kind] || esc.kind,
                kind_emoji: KIND_EMOJI[esc.kind] || '·',
                status: esc.status,
                priority: esc.priority,
                urgency: urgencyOf(esc),
                topic_code: esc.topic_code,
                student_message: esc.student_message,
                ai_summary: esc.ai_summary,
                context: esc.context,                       // 含完整 dossier
                created_at: esc.created_at,
                created_at_rel: fmtRel(esc.created_at),
                claimed_at: esc.claimed_at,
                claimed_at_rel: fmtRel(esc.claimed_at),
                expected_response_minutes: esc.expected_response_minutes,
                assigned_mentor_id: esc.assigned_mentor_id,
                resolution_kind: esc.resolution_kind,
                resolution_content: esc.resolution_content,
                student: { id: esc.students?.id, name: esc.students?.name, grade: esc.students?.grade },
            },
        });
    }

    // 列表
    const status = url.searchParams.get('status') || 'pending';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    if (!['pending', 'claimed', 'resolved', 'cancelled', 'all'].includes(status)) {
        return jsonErr(400, 'bad_status', 'status invalid');
    }

    const sel = encodeURIComponent('id,kind,status,priority,topic_code,student_message,ai_summary,created_at,claimed_at,resolved_at,expected_response_minutes,students!inner(name,grade)');
    let pgUrl = `/escalations?select=${sel}&order=priority.asc,created_at.asc&limit=${limit}`;
    if (status !== 'all') pgUrl += `&status=eq.${status}`;

    const r = await pgFetch(pgUrl);
    if (!r.ok) return jsonErr(502, 'pg_fetch_failed', `${r.status}`);
    const rows = await r.json();

    const items = rows.map(esc => ({
        id: esc.id,
        kind: esc.kind,
        kind_label: KIND_LABEL[esc.kind] || esc.kind,
        kind_emoji: KIND_EMOJI[esc.kind] || '·',
        status: esc.status,
        priority: esc.priority,
        urgency: urgencyOf(esc),
        topic_code: esc.topic_code,
        student_message: (esc.student_message || '').slice(0, 120),
        ai_summary: esc.ai_summary,
        student_name: esc.students?.name,
        student_grade: esc.students?.grade,
        created_at: esc.created_at,
        created_at_rel: fmtRel(esc.created_at),
        expected_response_minutes: esc.expected_response_minutes,
        waited_min: Math.round((Date.now() - new Date(esc.created_at).getTime()) / 60000),
    }));

    // 摘要
    const summary = {
        total: items.length,
        critical: items.filter(i => i.urgency === 'critical').length,
        urgent: items.filter(i => i.urgency === 'urgent').length,
        normal: items.filter(i => i.urgency === 'normal' || i.urgency === 'warning').length,
        avg_wait_min: items.length ? Math.round(items.reduce((s, i) => s + i.waited_min, 0) / items.length) : 0,
    };

    return jsonResp({ ok: true, status, items, summary, engine_version: 'mentor-queue-v1.0' });
}

async function handlePost(req) {
    let body;
    try { body = await req.json(); } catch (e) { return jsonErr(400, 'bad_json', 'JSON 解析失败'); }
    const { action, id, mentor_name, resolution_kind, resolution_content } = body || {};
    if (!action || !id) return jsonErr(400, 'missing_fields', 'action + id 必填');
    if (!UUID_RE.test(id)) return jsonErr(400, 'bad_id', 'id 必须是 UUID');

    if (action === 'claim') {
        // 把 status 从 pending 转 claimed · 写入 claimed_at + assigned_mentor_id（demo 期没真 mentor 表，存 meta.mentor_name）
        const patch = {
            status: 'claimed',
            claimed_at: new Date().toISOString(),
            meta: { mentor_name: mentor_name || '学长' },
        };
        const r = await pgFetch(`/escalations?id=eq.${id}&status=eq.pending`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify(patch),
        });
        if (!r.ok) return jsonErr(502, 'pg_patch_failed', `${r.status}`);
        const arr = await r.json();
        if (!arr.length) return jsonErr(409, 'already_claimed_or_not_pending', '该求助已被认领或不在 pending 状态');
        return jsonResp({ ok: true, action: 'claim', escalation: arr[0] });
    }

    if (action === 'resolve') {
        const validRk = ['text', 'screen_record', 'voice_call', 'video_call'];
        const rk = validRk.includes(resolution_kind) ? resolution_kind : 'text';
        const rc = String(resolution_content || '').slice(0, 4000);
        if (!rc) return jsonErr(400, 'missing_content', 'resolution_content 不能空');
        const patch = {
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_kind: rk,
            resolution_content: rc,
        };
        const r = await pgFetch(`/escalations?id=eq.${id}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify(patch),
        });
        if (!r.ok) return jsonErr(502, 'pg_patch_failed', `${r.status}`);
        const arr = await r.json();
        if (!arr.length) return jsonErr(404, 'not_found', 'escalation 不存在');
        return jsonResp({ ok: true, action: 'resolve', escalation: arr[0] });
    }

    return jsonErr(400, 'bad_action', 'action 必须是 claim 或 resolve');
}
