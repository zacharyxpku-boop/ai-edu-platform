// 原点智学 · FSRS 待复习题目端点
// GET /api/fsrs-due?student_id=xxx&limit=10
// → { due_count, items[], next_due_at }
//
// 数据来源：student_states 表的 fsrs_state jsonb（0001 已建）
// 算法：fsrs.priorityKey 排序 → due_at 已过 / retrievability 最低的优先
//
// 数据流：
//   学生答错 → ingest-attempt 写库 →（trigger 或 batch job）调 fsrs.update 更新 fsrs_state
//   学生开 mastery-loop → /api/fsrs-due → 拉 N 道今天该练的 → 渲染「今日复习」入口

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) : '';
const ENGINE_VERSION = 'fsrs-due-v1.0';

// FSRS 算法内联（Edge runtime 不支持 ESM import 跨目录，复制核心函数）
const DAY_MS = 86400000;
function calcRetrievability(stability, daysSince) {
    if (daysSince <= 0) return 1.0;
    return Math.pow(0.9, daysSince / Math.max(0.1, stability));
}
function priorityKey(fsrsState, now) {
    if (!fsrsState || !fsrsState.last_review_at) return -1;
    const days = (now - fsrsState.last_review_at) / DAY_MS;
    return calcRetrievability(fsrsState.stability, days);
}

function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ ok: false, error: code, message: msg }), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    if (req.method !== 'GET') return jsonErr(405, 'method_not_allowed', '只接受 GET');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return jsonErr(503, 'not_configured', 'Supabase env 未配');
    }

    const url = new URL(req.url);
    const studentId = url.searchParams.get('student_id');
    const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '10', 10));
    const useRpc = url.searchParams.get('rpc') === '1';   // 用 0005 的 SQL function（10x 性能）
    if (!studentId) return jsonErr(400, 'missing_student_id', 'student_id 必填');

    // 优先走 0005 的 fsrs_due_for_student RPC（PG 内部算 retrievability，省网络往返）
    if (useRpc && SUPABASE_SERVICE_KEY) {
        try {
            const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fsrs_due_for_student`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ p_student_id: studentId, p_limit: limit }),
            });
            if (r.ok) {
                const items = await r.json();
                return new Response(JSON.stringify({
                    ok: true, student_id: studentId,
                    via: 'rpc',
                    due_count: items.length,
                    items,
                    engine_version: ENGINE_VERSION + '+rpc',
                    now: new Date().toISOString(),
                }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
            }
        } catch (e) { /* fallback to anon path */ }
    }

    const now = Date.now();

    // 拉该学生所有 student_states（含 fsrs_state jsonb）
    // 用 anon key + RLS 的 PoC 期宽松策略
    try {
        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/student_states?` +
            `student_id=eq.${encodeURIComponent(studentId)}&` +
            `select=knowledge_point_id,mastery_score,fsrs_state,next_review_at,attempts_count,correct_count`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                }
            }
        );
        if (!r.ok) {
            const text = await r.text();
            return jsonErr(502, 'db_failed', `Supabase ${r.status}: ${text.slice(0, 200)}`);
        }
        const states = await r.json();

        // 过滤 + 排序：到期 / retrievability 最低的优先
        const due = states
            .map(s => ({
                knowledge_point_id: s.knowledge_point_id,
                mastery_score: s.mastery_score,
                attempts_count: s.attempts_count || 0,
                correct_count: s.correct_count || 0,
                fsrs_state: s.fsrs_state || null,
                retrievability: priorityKey(s.fsrs_state, now),
                is_due: !s.fsrs_state ||
                        !s.fsrs_state.due_at ||
                        now >= (typeof s.fsrs_state.due_at === 'number' ? s.fsrs_state.due_at : Date.parse(s.fsrs_state.due_at)),
                next_review_at: s.next_review_at,
            }))
            .filter(s => s.is_due || s.retrievability < 0.85)
            .sort((a, b) => a.retrievability - b.retrievability)
            .slice(0, limit);

        // 算下一个未到期的 due_at（提示「下次还要 X 小时」）
        const upcoming = states
            .map(s => s.fsrs_state?.due_at)
            .filter(t => t && (typeof t === 'number' ? t : Date.parse(t)) > now)
            .map(t => typeof t === 'number' ? t : Date.parse(t))
            .sort((a, b) => a - b);

        return new Response(JSON.stringify({
            ok: true,
            student_id: studentId,
            due_count: due.length,
            total_kps: states.length,
            items: due,
            next_due_at: upcoming[0] ? new Date(upcoming[0]).toISOString() : null,
            engine_version: ENGINE_VERSION,
            now: new Date(now).toISOString(),
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'private, max-age=30'
            }
        });
    } catch (e) {
        return jsonErr(502, 'upstream_unreachable', `Supabase 不可达: ${e.message}`);
    }
}
