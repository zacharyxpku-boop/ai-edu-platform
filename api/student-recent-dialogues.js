// 原点智学 · 学生最近对话拉取（给 parent-radar 家长视角看每条聊天）
// GET /api/student-recent-dialogues?student_id=<uuid>[&limit=20][&days=7]
//
// 返回该学生最近 N 天 / N 条对话，按时间倒序：
//   { ok: true, dialogues: [{ role, content, created_at, created_at_rel, kind, signals }],
//     summary: { total, by_role, days_active } }
//
// 设计意图：
//   家长比孩子更看重「过程透明」——孩子今天问了什么、AI 怎么答的、信号抽取识别到什么。
//   parent-radar 上原本只有雷达分数（中国家长普遍嫌「看不懂雷达，给我看孩子做了啥」）。
//   这个端点让家长视角增加「最近对话」tab，列每条对话 + 时间 + 信号摘要。
//
// 安全：
//   只暴露内容 / 时间 / signals 摘要；不暴露 embedding（向量泄漏隐私无意义）。
//   service-key 留后端，前端只 GET。

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResp(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'private, max-age=10',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
function jsonErr(status, code, msg) {
    return jsonResp({ ok: false, error: code, message: msg }, status);
}

function fmtRel(iso) {
    const t = new Date(iso).getTime();
    const diffMin = (Date.now() - t) / 60000;
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${Math.round(diffMin)} 分钟前`;
    if (diffMin < 1440) return `${Math.round(diffMin / 60)} 小时前`;
    if (diffMin < 10080) return `${Math.round(diffMin / 1440)} 天前`;
    return new Date(iso).toLocaleDateString('zh-CN');
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'content-type',
            },
        });
    }
    if (req.method !== 'GET') return jsonErr(405, 'method_not_allowed', 'GET only');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return jsonErr(503, 'not_configured', 'SUPABASE env not set');
    }

    const url = new URL(req.url);
    const studentId = (url.searchParams.get('student_id') || '').trim().toLowerCase();
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20'), 1), 100);
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '7'), 1), 90);
    if (!UUID_RE.test(studentId)) return jsonErr(400, 'bad_student_id', 'student_id 必须是合法 UUID');

    const sinceIso = new Date(Date.now() - days * 86400 * 1000).toISOString();
    // 走 PostgREST：按时间倒排 + 时间窗过滤
    const sel = encodeURIComponent('role,content,created_at,kind,meta');
    const pgUrl = `${SUPABASE_URL}/rest/v1/dialogues?student_id=eq.${studentId}` +
        `&created_at=gte.${encodeURIComponent(sinceIso)}` +
        `&select=${sel}&order=created_at.desc&limit=${limit}`;

    let rows;
    try {
        const r = await fetch(pgUrl, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
                'Accept': 'application/json',
            },
        });
        if (!r.ok) {
            const detail = await r.text().catch(() => '');
            return jsonErr(502, 'pg_fetch_failed', `${r.status}: ${detail.slice(0, 200)}`);
        }
        rows = await r.json();
    } catch (e) {
        return jsonErr(502, 'pg_network', e.message);
    }
    if (!Array.isArray(rows)) return jsonErr(502, 'pg_bad_shape', 'expected array');

    const dialogues = rows.map(row => {
        const meta = row.meta || {};
        const sig = meta.signals || {};
        return {
            role: row.role,
            content: row.content,
            kind: row.kind || 'chat',
            created_at: row.created_at,
            created_at_rel: fmtRel(row.created_at),
            // 只暴露给家长有意义的几个 signals 字段，不传 embedding 等
            signals: {
                stuck_point: sig.stuck_point || null,
                emotion_state: sig.emotion_state || null,
                analogy_effective: sig.analogy_effective ?? null,
                cognitive_style: sig.cognitive_style && sig.cognitive_style !== 'unknown' ? sig.cognitive_style : null,
            },
            is_pasted: meta.is_pasted === true,
        };
    });

    // 摘要：按 role 计数 + 几天有过对话
    const byRole = {};
    const dateSet = new Set();
    for (const d of dialogues) {
        byRole[d.role] = (byRole[d.role] || 0) + 1;
        dateSet.add(new Date(d.created_at).toISOString().slice(0, 10));
    }

    return jsonResp({
        ok: true,
        student_id: studentId,
        window_days: days,
        dialogues,
        summary: {
            total: dialogues.length,
            by_role: byRole,
            days_active: dateSet.size,
        },
        engine_version: 'recent-dialogues-v1.0',
    });
}
