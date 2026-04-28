// 原点智学 · /api/parent-push · 家长主动 push 通道
//
// 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md 三角形「家长省心放心」
//   parent-brief = 被动接收（家长打开 parent-radar 才看到）
//   parent-push  = 主动 push（关键时刻发到家长手机）
//
// 4 类触发器 + crisis：
//   1) emotion_signals     · 情绪信号 ≥ 2 次/24h
//   2) escalation_overdue  · 学长 escalation pending > 60min
//   3) weekly_brief        · 周日 19:00 周报 ready
//   4) monthly_summary     · 每月 1 日 9:00 月度对比
//   crisis                 · T6 危机信号（最高优先级，立即 push）
//
// schema：db/migrations/0009_parent_pushes.sql
//
// 端点：
//   POST  /api/parent-push     · 后端调（cron / 业务事件）落库一条 push
//                                 不暴露给前端学生侧
//                                 入参 { student_id, trigger_kind, title, body, deeplink?, meta? }
//                                 demo 期不真发推送（PWA/微信通道未集成），落库即「已生成」
//   GET   /api/parent-push?student_id=xxx&unread_only=1
//                              · parent-radar 顶部徽章读这个
//
// 设计哲学：
//   1. trigger_kind 白名单严格校验 → 防业务侧乱写
//   2. crisis priority 强制 1，永不被去重盖掉
//   3. PG unique index (student_id, trigger_kind, day) 兜底防刷屏
//   4. 502 / 409（duplicate key）都返回结构化错误，cron 端可识别

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env)
    ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env)
    ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_TRIGGERS = [
    'emotion_signals',
    'escalation_overdue',
    'weekly_brief',
    'monthly_summary',
    'crisis',
];

// trigger_kind → priority（数字越小优先级越高）
const PRIORITY_MAP = {
    crisis: 1,             // 最高 · 立即介入
    escalation_overdue: 2, // 高 · 1 小时内有人没接
    emotion_signals: 3,    // 中 · 情绪累积
    weekly_brief: 3,       // 普通 · 按时
    monthly_summary: 3,    // 普通 · 按时
};

// trigger_kind → 中文名（log / 运营 dashboard）
const TRIGGER_CN = {
    emotion_signals: '情绪信号累积',
    escalation_overdue: '学长求助超时',
    weekly_brief: '周报已生成',
    monthly_summary: '月度学习总结',
    crisis: '危机信号 · 立即介入',
};

// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------

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

    if (req.method === 'GET') return handleList(req);
    if (req.method === 'POST') return handleCreate(req);

    return jsonErr(405, 'method_not_allowed', 'GET or POST only');
}

// ---------------------------------------------------------------------------
// POST · 落库一条 push
// ---------------------------------------------------------------------------

async function handleCreate(req) {
    let body;
    try {
        body = await req.json();
    } catch (e) {
        return jsonErr(400, 'bad_json', '请求体不是合法 JSON');
    }

    const {
        student_id,
        trigger_kind,
        title,
        body: pushBody,
        deeplink,
        meta = {},
    } = body || {};

    // ---- 必填校验 ----
    if (!student_id || !trigger_kind || !title || !pushBody) {
        return jsonErr(400, 'missing_fields',
            'student_id + trigger_kind + title + body 必填');
    }
    if (!UUID_RE.test(student_id)) {
        return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');
    }
    if (!VALID_TRIGGERS.includes(trigger_kind)) {
        return jsonErr(400, 'bad_trigger_kind',
            `trigger_kind 必须是 ${VALID_TRIGGERS.join('/')} 之一`);
    }

    const safeTitle = String(title).slice(0, 50);
    const safeBody = String(pushBody).slice(0, 200);
    const safeDeeplink = deeplink ? String(deeplink).slice(0, 500) : null;
    const safeMeta = (typeof meta === 'object' && meta) ? meta : {};

    const priority = PRIORITY_MAP[trigger_kind] || 3;

    const insertBody = {
        student_id,
        trigger_kind,
        title: safeTitle,
        body: safeBody,
        deeplink: safeDeeplink,
        priority,
        status: 'pending',  // demo 期：落库即结束，不真发
        meta: {
            ...safeMeta,
            trigger_cn: TRIGGER_CN[trigger_kind] || trigger_kind,
            generated_at: new Date().toISOString(),
        },
    };

    let inserted;
    try {
        const r = await pgFetch('/parent_pushes', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify(insertBody),
        });
        if (!r.ok) {
            const detail = await r.text().catch(() => '');
            // 23505 = unique_violation（同 student + 同 kind + 同天 已有）
            if (r.status === 409 || detail.includes('23505') || detail.includes('duplicate')) {
                return jsonResp({
                    ok: true,
                    deduped: true,
                    message: '同类 push 今日已生成（去重命中）',
                    trigger_kind,
                    student_id,
                }, 200);
            }
            return jsonErr(502, 'pg_insert_failed', `${r.status}: ${detail.slice(0, 200)}`);
        }
        const arr = await r.json();
        inserted = Array.isArray(arr) ? arr[0] : arr;
    } catch (e) {
        return jsonErr(502, 'pg_network', e.message);
    }

    return jsonResp({
        ok: true,
        push_id: inserted.id,
        student_id,
        trigger_kind,
        trigger_cn: TRIGGER_CN[trigger_kind],
        priority: inserted.priority,
        status: inserted.status,
        created_at: inserted.created_at,
        // demo 期不真发，sent_at 为 null
        delivery_note: 'demo 期落库即结束 · PWA/微信推送通道未集成',
        engine_version: 'parent-push-v1.0',
    });
}

// ---------------------------------------------------------------------------
// GET · 列学生的 push（parent-radar 徽章用）
// ---------------------------------------------------------------------------

async function handleList(req) {
    const url = new URL(req.url);
    const studentId = (url.searchParams.get('student_id') || '').trim().toLowerCase();
    const unreadOnly = url.searchParams.get('unread_only') === '1';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

    if (!UUID_RE.test(studentId)) {
        return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');
    }

    let pgUrl = `/parent_pushes?student_id=eq.${studentId}&select=*&order=priority.asc,created_at.desc&limit=${limit}`;
    if (unreadOnly) {
        pgUrl += `&status=in.(pending,sent)`;
    }

    let rows;
    try {
        const r = await pgFetch(pgUrl);
        if (!r.ok) return jsonErr(502, 'pg_fetch_failed', `${r.status}`);
        rows = await r.json();
    } catch (e) {
        return jsonErr(502, 'pg_network', e.message);
    }

    const pushes = (rows || []).map(row => ({
        id: row.id,
        trigger_kind: row.trigger_kind,
        trigger_cn: TRIGGER_CN[row.trigger_kind] || row.trigger_kind,
        title: row.title,
        body: row.body,
        deeplink: row.deeplink,
        priority: row.priority,
        status: row.status,
        created_at: row.created_at,
        created_at_rel: fmtRelMin(row.created_at),
        read_at: row.read_at,
    }));

    const summary = {
        total: pushes.length,
        unread: pushes.filter(p => p.status === 'pending' || p.status === 'sent').length,
        crisis: pushes.filter(p => p.trigger_kind === 'crisis' && p.status !== 'read').length,
    };

    return jsonResp({
        ok: true,
        student_id: studentId,
        pushes,
        summary,
        engine_version: 'parent-push-v1.0',
    });
}
