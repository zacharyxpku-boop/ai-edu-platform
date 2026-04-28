// 原点智学 · /api/escalate · 学生升级到真人辅导队列
//
// POST 创建一条 escalation（学生显式呼叫 / AI prompt 检测后台触发 / mastery-loop 答错 3 次自动）
// GET ?student_id=xxx 列学生自己的 escalation 历史（前端右栏「呼叫记录」用）
//
// 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md 三档分诊
// schema：db/migrations/0007_escalations.sql

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_KINDS = ['concept', 'emotion', 'streak_3_wrong', 'planning', 'manual'];

function jsonResp(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
function jsonErr(status, code, msg) {
    return jsonResp({ ok: false, error: code, message: msg }, status);
}

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

function fmtRelMin(iso) {
    const t = new Date(iso).getTime();
    const diffMin = (Date.now() - t) / 60000;
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${Math.round(diffMin)} 分钟前`;
    if (diffMin < 1440) return `${Math.round(diffMin / 60)} 小时前`;
    return `${Math.round(diffMin / 1440)} 天前`;
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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return jsonErr(503, 'not_configured', 'SUPABASE env not set');
    }

    if (req.method === 'GET') {
        return handleList(req);
    }

    if (req.method === 'POST') {
        return handleCreate(req);
    }

    return jsonErr(405, 'method_not_allowed', 'GET or POST only');
}

async function handleCreate(req) {
    let body;
    try {
        body = await req.json();
    } catch (e) {
        return jsonErr(400, 'bad_json', '请求体不是合法 JSON');
    }

    const {
        student_id,
        kind,
        student_message,
        context = {},
        ai_summary,
        topic_code,
        dialogue_id,
        expected_response_minutes,
    } = body || {};

    if (!student_id || !kind || !student_message) {
        return jsonErr(400, 'missing_fields', 'student_id + kind + student_message 必填');
    }
    if (!UUID_RE.test(student_id)) {
        return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');
    }
    if (!VALID_KINDS.includes(kind)) {
        return jsonErr(400, 'bad_kind', `kind 必须是 ${VALID_KINDS.join('/')} 之一`);
    }

    const safeMsg = String(student_message).slice(0, 2000);
    const safeContext = (typeof context === 'object' && context) ? context : {};

    // 默认期望响应：emotion=15min（情绪危机优先）/ concept=30min / streak=60min / planning/manual=120min
    const defaultETA = { emotion: 15, concept: 30, streak_3_wrong: 60, planning: 120, manual: 120 }[kind] || 60;
    const eta = (typeof expected_response_minutes === 'number' && expected_response_minutes > 0)
        ? Math.min(expected_response_minutes, 1440)
        : defaultETA;

    // 拼弹药包：调 student-dossier 端点把完整档案塞进 context.dossier（让学长 30 秒入戏）
    // P1-2 升级：从「只塞 weak_kps」升级为「塞完整学情档案」
    let enrichedContext = { ...safeContext };
    try {
        const origin = new URL(req.url).origin;
        const dossierResp = await fetch(`${origin}/api/student-dossier?student_id=${student_id}`, {
            // 内部调用，不需要 auth
            headers: { 'Accept': 'application/json' },
        });
        if (dossierResp.ok) {
            const dossier = await dossierResp.json();
            if (dossier.ok) {
                enrichedContext.dossier = {
                    mentor_brief: dossier.mentor_brief,
                    profile: dossier.profile,
                    stats: dossier.stats,
                    weak_kps: dossier.weak_kps,
                    mistake_top: dossier.mistake_top,
                    recent_dialogues: dossier.recent_dialogues?.slice(0, 2),  // 只塞 2 条避免 jsonb 过大
                };
            }
        }
    } catch (e) {
        // 弹药包丰富失败不阻塞 escalation 创建（fallback 到 safeContext 即可）
    }
    // Fallback：如果 dossier 拉失败，至少塞 weak_kps（旧逻辑保底）
    if (!enrichedContext.dossier) {
        try {
            const r = await pgFetch(`/student_states?student_id=eq.${student_id}&select=mastery_score,knowledge_points!inner(code,name)&order=mastery_score.asc&limit=3`);
            if (r.ok) {
                const states = await r.json();
                enrichedContext.weak_kps = states.map(s => ({
                    code: s.knowledge_points?.code,
                    name: s.knowledge_points?.name,
                    mastery: s.mastery_score,
                }));
            }
        } catch (e) {}
    }

    const insertBody = {
        student_id,
        kind,
        student_message: safeMsg,
        context: enrichedContext,
        ai_summary: ai_summary ? String(ai_summary).slice(0, 500) : null,
        topic_code: topic_code || null,
        dialogue_id: dialogue_id && UUID_RE.test(dialogue_id) ? dialogue_id : null,
        expected_response_minutes: eta,
    };

    let inserted;
    try {
        const r = await pgFetch('/escalations', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify(insertBody),
        });
        if (!r.ok) {
            const detail = await r.text().catch(() => '');
            return jsonErr(502, 'pg_insert_failed', `${r.status}: ${detail.slice(0, 200)}`);
        }
        const arr = await r.json();
        inserted = Array.isArray(arr) ? arr[0] : arr;
    } catch (e) {
        return jsonErr(502, 'pg_network', e.message);
    }

    return jsonResp({
        ok: true,
        escalation_id: inserted.id,
        priority: inserted.priority,
        expected_response_minutes: inserted.expected_response_minutes,
        message: kindMessage(kind, inserted.expected_response_minutes),
        engine_version: 'escalate-v1.0',
    });
}

function kindMessage(kind, eta) {
    const map = {
        concept: `已转给学长学姐 · 概念性问题约 ${eta} 分钟内回你。等的时候可以做下一道题`,
        emotion: `老师看见你了 · 这种感觉学姐比我懂得讲，约 ${eta} 分钟内联系你`,
        streak_3_wrong: `这一类题咱多卡了几次 · 让学长录个 3 分钟讲解，约 ${eta} 分钟内发你`,
        planning: `规划级问题让学长姐姐回 · 约 ${eta} 分钟（他们要先看你的档案）`,
        manual: `已发出 · 学长学姐约 ${eta} 分钟内联系你 · 等的时候做点别的`,
    };
    return map[kind] || `已发出 · 约 ${eta} 分钟内有人回你`;
}

async function handleList(req) {
    const url = new URL(req.url);
    const studentId = (url.searchParams.get('student_id') || '').trim().toLowerCase();
    const status = url.searchParams.get('status'); // pending|claimed|resolved|cancelled
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    if (!UUID_RE.test(studentId)) {
        return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');
    }

    let pgUrl = `/escalations?student_id=eq.${studentId}&select=*&order=created_at.desc&limit=${limit}`;
    if (status && ['pending', 'claimed', 'resolved', 'cancelled'].includes(status)) {
        pgUrl += `&status=eq.${status}`;
    }

    let rows;
    try {
        const r = await pgFetch(pgUrl);
        if (!r.ok) return jsonErr(502, 'pg_fetch_failed', `${r.status}`);
        rows = await r.json();
    } catch (e) {
        return jsonErr(502, 'pg_network', e.message);
    }

    const escalations = (rows || []).map(row => ({
        id: row.id,
        kind: row.kind,
        status: row.status,
        priority: row.priority,
        student_message: row.student_message,
        topic_code: row.topic_code,
        created_at: row.created_at,
        created_at_rel: fmtRelMin(row.created_at),
        expected_response_minutes: row.expected_response_minutes,
        claimed_at: row.claimed_at,
        resolved_at: row.resolved_at,
        resolution_kind: row.resolution_kind,
        resolution_content: row.resolution_content ? String(row.resolution_content).slice(0, 300) : null,
        resolution_minutes: row.resolution_minutes,
    }));

    const summary = {
        total: escalations.length,
        pending: escalations.filter(e => e.status === 'pending').length,
        claimed: escalations.filter(e => e.status === 'claimed').length,
        resolved: escalations.filter(e => e.status === 'resolved').length,
    };

    return jsonResp({
        ok: true,
        student_id: studentId,
        escalations,
        summary,
        engine_version: 'escalate-v1.0',
    });
}
