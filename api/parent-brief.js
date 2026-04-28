// 原点智学 · /api/parent-brief
// GET ?student_id=<uuid>&period=morning|weekly
//
// 妈妈每天 30 秒看懂的 AI 简报。
// 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md 三角形「家长省心放心」
//
// 输出结构（前端 parent-radar 顶部「今日给妈妈的话」面板用）：
// {
//   ok: true,
//   period: 'morning' | 'weekly',
//   headline:    "昨晚 25 分钟 · 3 对 1 错 · 错的『移项变号』自己想出来了",
//   today_focus: "今天 16:00 该练『分式去分母』（FSRS 推算）",
//   parent_note: "昨晚 21:30 说想睡，今天别催太狠",  // 关键时刻提示
//   detailed: { dialogues_count, attempts, weak_kps, emotions, escalations },
// }
//
// 设计哲学：
//   1. headline 必须 ≤ 35 字（妈妈一眼扫完）
//   2. today_focus 必须含具体 KP 名 + 时间
//   3. parent_note 仅在有真信号时显示（情绪/疲劳/呼叫学长）—— 没信号就不输出
//   4. 全 deterministic（不依赖 LLM 一致性），保证 demo 现场不抖
//   5. 未来 P1 可加 ?enrich=llm 让 DeepSeek 把 headline 写得更生动

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResp(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'private, max-age=60',  // 1 分钟 cache（多人同时看不打库）
            'Access-Control-Allow-Origin': '*',
        },
    });
}
function jsonErr(status, code, msg) {
    return jsonResp({ ok: false, error: code, message: msg }, status);
}

async function pgFetch(path) {
    return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
            'Accept': 'application/json',
        },
    });
}

function fmtMin(min) {
    if (min < 1) return '不到 1 分钟';
    if (min < 60) return `${Math.round(min)} 分钟`;
    return `${Math.round(min / 60 * 10) / 10} 小时`;
}

// 把对话时间戳数组算总活跃时长（连续 ≤5min gap 算同一段，>5min 切段累加）
function calcActiveMinutes(timestamps) {
    if (timestamps.length === 0) return 0;
    const sorted = timestamps.map(t => new Date(t).getTime()).sort((a, b) => a - b);
    let total = 0;
    let segStart = sorted[0];
    let segLast = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i] - segLast;
        if (gap <= 5 * 60 * 1000) {
            segLast = sorted[i];
        } else {
            total += (segLast - segStart);
            segStart = sorted[i];
            segLast = sorted[i];
        }
    }
    total += (segLast - segStart);
    return total / 60000;
}

function detectEmotionSignals(dialogues) {
    // 在最近 dialogues 里找 emotion_state ≥ 2 次焦虑/无力/否定 = 触发 parent_note
    const negEmotions = ['焦虑', '无力', '否定自我', '挫败', '想放弃'];
    const hits = dialogues.filter(d => {
        const e = d.meta?.signals?.emotion_state;
        return e && negEmotions.includes(e);
    });
    return { count: hits.length, examples: hits.slice(0, 2).map(h => h.content?.slice(0, 30)) };
}

function findLateNightSignals(dialogues) {
    // 检测是否有 21:30 之后的对话 + 「累 / 困 / 想睡」关键词
    const tired = ['累', '困', '想睡', '没精神', '不行了', '撑不住'];
    return dialogues.find(d => {
        const hour = new Date(d.created_at).getHours();
        if (hour < 21 && hour > 6) return false;
        const c = d.content || '';
        return tired.some(t => c.includes(t));
    });
}

function pickTodayFocus(weakKps) {
    if (!weakKps.length) return '今天还没有特别推荐的 KP，让孩子先做点错题复习';
    const due = weakKps.filter(k => k.next_review_at && new Date(k.next_review_at) <= new Date());
    const target = due[0] || weakKps[0];
    if (!target) return '让孩子先选一个想攻的方向';
    const name = target.knowledge_points?.name || target.code || '某知识点';
    const score = (target.mastery_score * 100).toFixed(0);
    return `今天 16:00 该练「${name}」（当前掌握 ${score}%）`;
}

function buildHeadline(period, attempts, dialogues, escalations) {
    const minutes = Math.round(calcActiveMinutes(dialogues.map(d => d.created_at)));
    const total = attempts.length;
    const correct = attempts.filter(a => a.is_correct).length;
    const wrong = total - correct;

    if (period === 'weekly') {
        if (total === 0) return `本周聊了 ${minutes} 分钟 · 还没真做题，建议下周开始练`;
        return `本周 ${minutes} 分钟 · ${correct} 对 ${wrong} 错 · ${escalations.length} 次找学长`;
    }

    // morning
    if (total === 0 && minutes < 1) return '昨晚没用 · 今天可以让他先做 5 分钟暖暖手';
    if (total === 0) return `昨晚聊了 ${minutes} 分钟 · 没做题但聊了思路`;

    // 找昨晚 attempts 里最有 narrative 价值的：从错到对
    const flips = attempts.filter(a => a.is_correct && a.scored_meta?.flipped_from_wrong);
    if (flips.length > 0) {
        const kpHint = flips[0].scored_meta?.kp_name || '某一步';
        return `昨晚 ${minutes} 分钟 · ${correct} 对 ${wrong} 错 · 错的「${kpHint}」自己想出来了`;
    }

    return `昨晚 ${minutes} 分钟 · ${correct} 对 ${wrong} 错`;
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return jsonErr(503, 'not_configured', 'SUPABASE env not set');

    const url = new URL(req.url);
    const studentId = (url.searchParams.get('student_id') || '').trim().toLowerCase();
    const period = url.searchParams.get('period') === 'weekly' ? 'weekly' : 'morning';
    if (!UUID_RE.test(studentId)) return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');

    const days = period === 'weekly' ? 7 : 1;
    const sinceIso = new Date(Date.now() - days * 86400 * 1000).toISOString();

    // 并行拉 dialogues / attempts / escalations / weak KPs
    const [dialoguesRes, attemptsRes, escalationsRes, statesRes] = await Promise.all([
        pgFetch(`/dialogues?student_id=eq.${studentId}&created_at=gte.${encodeURIComponent(sinceIso)}&select=role,content,kind,created_at,meta&order=created_at.desc&limit=200`),
        pgFetch(`/attempts?student_id=eq.${studentId}&submitted_at=gte.${encodeURIComponent(sinceIso)}&select=is_correct,response,time_spent_ms,scored_meta,knowledge_point_ids&order=submitted_at.desc&limit=200`),
        pgFetch(`/escalations?student_id=eq.${studentId}&created_at=gte.${encodeURIComponent(sinceIso)}&select=kind,status,student_message,created_at&order=created_at.desc&limit=20`),
        pgFetch(`/student_states?student_id=eq.${studentId}&select=mastery_score,next_review_at,knowledge_points!inner(code,name)&order=mastery_score.asc&limit=10`),
    ]);

    const dialogues = dialoguesRes.ok ? await dialoguesRes.json() : [];
    const attempts = attemptsRes.ok ? await attemptsRes.json() : [];
    const escalations = escalationsRes.ok ? await escalationsRes.json() : [];
    const states = statesRes.ok ? await statesRes.json() : [];

    const weakKps = states.filter(s => s.mastery_score < 0.85);

    // 三件输出：headline / today_focus / parent_note
    const headline = buildHeadline(period, attempts, dialogues, escalations);
    const todayFocus = pickTodayFocus(weakKps);

    // parent_note · 只在有真信号时才输出（不强行写）
    let parentNote = null;
    const lateTired = findLateNightSignals(dialogues);
    if (lateTired) {
        parentNote = `昨晚 ${new Date(lateTired.created_at).getHours()}:${String(new Date(lateTired.created_at).getMinutes()).padStart(2, '0')} 提到「${lateTired.content?.slice(0, 18)}」，今天别催太狠`;
    } else {
        const emo = detectEmotionSignals(dialogues);
        if (emo.count >= 2) {
            parentNote = `${period === 'weekly' ? '本周' : '昨晚'}焦虑信号 ${emo.count} 次，可能压力偏大`;
        } else {
            const pendingEsc = escalations.filter(e => e.status === 'pending').length;
            if (pendingEsc > 0) {
                parentNote = `还有 ${pendingEsc} 条没回的学长求助 · 等回复中`;
            }
        }
    }

    return jsonResp({
        ok: true,
        period,
        headline,
        today_focus: todayFocus,
        parent_note: parentNote,  // 可能 null
        detailed: {
            dialogues_count: dialogues.length,
            student_messages: dialogues.filter(d => d.role === 'student').length,
            tutor_messages: dialogues.filter(d => d.role === 'tutor').length,
            attempts_total: attempts.length,
            attempts_correct: attempts.filter(a => a.is_correct).length,
            active_minutes: Math.round(calcActiveMinutes(dialogues.map(d => d.created_at))),
            escalations: escalations.map(e => ({ kind: e.kind, status: e.status, created_at: e.created_at })),
            weak_top3: weakKps.slice(0, 3).map(s => ({
                code: s.knowledge_points?.code,
                name: s.knowledge_points?.name,
                mastery: s.mastery_score,
            })),
        },
        engine_version: 'parent-brief-v1.0',
    });
}
