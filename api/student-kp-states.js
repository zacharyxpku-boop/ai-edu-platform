// 原点智学 · 学生 KP 学习状态拉取（给 tutor.html 右栏 / parent-radar 用）
// GET /api/student-kp-states?student_id=<uuid>[&subject=math]
//
// 返回 student_states JOIN knowledge_points 后的扁平 JSON：
//   { ok: true, states: [{code, name, mastery_score, attempts_count, correct_count,
//                          last_practiced_at, next_review_at, stage}], summary: {...} }
//
// stage 三档：已掌握 (≥0.85) / 攻克中 (0.5-0.85) / 待补 (<0.5)
// summary：让前端不用自己 reduce，直接拿 done_count / active_count / due_count
//
// 设计意图：
//   tutor.html 右栏现在 hardcode「现在练 X 0.62 / 最近卡点 3 项 / 明天 19:00 复习」，
//   接这个端点后改成 fetch + 渲染真库数据。SQL 不在前端做（防 service-key 泄漏）。

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResp(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'private, max-age=15',
            'Access-Control-Allow-Origin': '*',
        },
    });
}

function jsonErr(status, code, msg) {
    return jsonResp({ ok: false, error: code, message: msg }, status);
}

function classifyStage(score) {
    if (score >= 0.85) return '已掌握';
    if (score >= 0.5) return '攻克中';
    return '待补';
}

function fmtRelTime(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    const now = Date.now();
    const diff = t - now; // 正=未来，负=过去
    const absMin = Math.abs(diff) / 60000;
    if (absMin < 60) return diff > 0 ? `${Math.round(absMin)} 分钟后` : `${Math.round(absMin)} 分钟前`;
    if (absMin < 1440) return diff > 0 ? `${Math.round(absMin / 60)} 小时后` : `${Math.round(absMin / 60)} 小时前`;
    return diff > 0 ? `${Math.round(absMin / 1440)} 天后` : `${Math.round(absMin / 1440)} 天前`;
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
    const subject = (url.searchParams.get('subject') || '').trim();
    if (!UUID_RE.test(studentId)) return jsonErr(400, 'bad_student_id', 'student_id 必须是合法 UUID');

    // PostgREST 走 student_states with embedded knowledge_points (resource embedding)
    // select 列名遵循 PostgREST 嵌入语法：knowledge_points!inner(code,name,subject)
    const sel = encodeURIComponent('mastery_score,attempts_count,correct_count,last_practiced_at,next_review_at,fsrs_state,knowledge_points!inner(code,name,subject)');
    let pgUrl = `${SUPABASE_URL}/rest/v1/student_states?student_id=eq.${studentId}&select=${sel}&order=mastery_score.desc.nullslast`;
    if (subject) pgUrl += `&knowledge_points.subject=eq.${encodeURIComponent(subject)}`;

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

    const states = rows.map(row => {
        const kp = row.knowledge_points || {};
        const score = Number(row.mastery_score) || 0;
        return {
            code: kp.code,
            name: kp.name,
            subject: kp.subject,
            mastery_score: score,
            attempts_count: row.attempts_count || 0,
            correct_count: row.correct_count || 0,
            accuracy: row.attempts_count > 0 ? Number((row.correct_count / row.attempts_count).toFixed(2)) : null,
            last_practiced_at: row.last_practiced_at,
            last_practiced_rel: fmtRelTime(row.last_practiced_at),
            next_review_at: row.next_review_at,
            next_review_rel: fmtRelTime(row.next_review_at),
            stage: classifyStage(score),
            // FSRS 内部状态原样回传（前端不用，给 fsrs-update 用）
            fsrs_state: row.fsrs_state || null,
        };
    });

    // 摘要（让前端不用自己跑 reduce）
    const summary = {
        total: states.length,
        done: states.filter(s => s.stage === '已掌握').length,
        active: states.filter(s => s.stage === '攻克中').length,
        weak: states.filter(s => s.stage === '待补').length,
        due_now: states.filter(s => s.next_review_at && new Date(s.next_review_at).getTime() <= Date.now()).length,
        // 「现在该练」：取 mastery 最低且已到期的；都没到期取 mastery 最低
        next_focus: pickNextFocus(states),
    };

    return jsonResp({
        ok: true,
        student_id: studentId,
        states,
        summary,
        engine_version: 'kp-states-v1.0',
    });
}

function pickNextFocus(states) {
    if (!states.length) return null;
    const now = Date.now();
    const due = states.filter(s => s.next_review_at && new Date(s.next_review_at).getTime() <= now);
    if (due.length) {
        return due.sort((a, b) => a.mastery_score - b.mastery_score)[0];
    }
    // 没到期就找掌握度最低的活跃 KP（排除已掌握 ≥0.85）
    const active = states.filter(s => s.mastery_score < 0.85);
    if (active.length) {
        return active.sort((a, b) => a.mastery_score - b.mastery_score)[0];
    }
    return states[0];
}
