// 原点智学 · /api/student-dossier · 学情档案
//
// GET ?student_id=<uuid>&format=json|markdown
//
// 学长接 escalation 前 30 秒看完，不重复摸底。
// 这是 B 模式（学长 1v3 异步攻坚）能扛住单价 ¥1500/月 的供给侧壁垒。
//
// 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md 三圈层 §6
// 自动场景：每条 /api/escalate POST 内部会调本端点，把档案 JSON 塞进 escalations.context.dossier
//
// 输出（json）：
// {
//   student: { name, grade, registered_days, last_active_at },
//   profile: {                      // 6 字段画像
//     cognitive_style, cognitive_style_confidence,
//     dominant_emotion,
//     analogy_success_rate,
//     top_stuck_points: [...],
//     top_interests: [...],
//   },
//   stats: {                        // 数据栅栏
//     total_attempts, accuracy, active_days_last_7,
//     dialogues_last_7, escalations_pending,
//   },
//   weak_kps: [                     // mastery 最低 5 个 KP
//     { code, name, mastery, last_practiced_rel }
//   ],
//   mistake_top: [                  // 错题图谱前 5
//     { tag, label, category, count, sample_root_cause }
//   ],
//   recent_dialogues: [             // 最近 3 条对话摘要
//     { role, content_excerpt, signals_summary, created_at_rel }
//   ],
//   pending_escalations: [          // 待回的 escalation
//     { id, kind, student_message, created_at_rel, eta_min }
//   ],
//   mentor_brief: "学姐接班指引：3 行话给学长看的速读"
// }

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GRADE_CN = {
    primary_1:'小一',primary_2:'小二',primary_3:'小三',primary_4:'小四',primary_5:'小五',primary_6:'小六',
    middle_1:'初一',middle_2:'初二',middle_3:'初三',
    high_1:'高一',high_2:'高二',high_3:'高三',
};
const COG_STYLE_CN = { visual:'视觉型', verbal:'言语型', kinesthetic:'动手型', abstract:'抽象型', unknown:'未知' };

function jsonResp(obj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'private, max-age=30',
            'Access-Control-Allow-Origin': '*',
            ...extraHeaders,
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

function fmtRel(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    if (diff < 60000) return '刚刚';
    if (diff < 3600_000) return `${Math.round(diff / 60000)} 分钟前`;
    if (diff < 86400_000) return `${Math.round(diff / 3600_000)} 小时前`;
    return `${Math.round(diff / 86400_000)} 天前`;
}

// 把档案渲染成 markdown 给学长打印 / 直接复制
function renderMarkdown(d) {
    const L = [];
    L.push(`# 学情档案 · ${d.student.name || '同学'}`);
    L.push('');
    L.push(`**${d.student.grade_cn || '中学生'}** · 入站 ${d.student.registered_days} 天 · 最近活跃 ${d.student.last_active_rel || '—'}`);
    L.push('');
    L.push('## 一句话速读（学长接班用）');
    L.push(`> ${d.mentor_brief}`);
    L.push('');
    L.push('## 六字段画像');
    L.push(`- 认知风格：**${COG_STYLE_CN[d.profile.cognitive_style] || d.profile.cognitive_style || '未知'}**（置信 ${Math.round((d.profile.cognitive_style_confidence || 0) * 100)}%）`);
    L.push(`- 主导情绪：**${d.profile.dominant_emotion || '平和'}**`);
    L.push(`- 类比奏效率：**${d.profile.analogy_success_rate != null ? Math.round(d.profile.analogy_success_rate * 100) + '%' : '样本不足'}**`);
    if (d.profile.top_stuck_points?.length) {
        L.push(`- 长期卡点：${d.profile.top_stuck_points.map(s => `\`${s}\``).join(' / ')}`);
    }
    if (d.profile.top_interests?.length) {
        L.push(`- 兴趣锚点（可借为类比）：${d.profile.top_interests.join(' / ')}`);
    }
    L.push('');
    L.push('## 学情数据');
    L.push(`- 总答题：${d.stats.total_attempts} 道（正确率 ${Math.round(d.stats.accuracy * 100)}%）`);
    L.push(`- 近 7 天活跃天数：${d.stats.active_days_last_7} / 7`);
    L.push(`- 近 7 天对话：${d.stats.dialogues_last_7} 条`);
    L.push('');
    if (d.weak_kps?.length) {
        L.push('## 当前最弱 5 个知识点');
        for (const k of d.weak_kps) {
            L.push(`- **${k.name}** （mastery ${Math.round(k.mastery * 100)}% · ${k.last_practiced_rel || '从没练过'}）`);
        }
        L.push('');
    }
    if (d.mistake_top?.length) {
        L.push('## 错题图谱 Top');
        for (const m of d.mistake_top) {
            L.push(`- **${m.label}** [${m.category}] · 错 ${m.count} 次${m.sample_root_cause ? `\n  - 根因：${m.sample_root_cause}` : ''}`);
        }
        L.push('');
    }
    if (d.pending_escalations?.length) {
        L.push('## 待回的求助');
        for (const e of d.pending_escalations) {
            L.push(`- [${e.kind}] ${e.student_message.slice(0, 80)} · ${e.created_at_rel}`);
        }
        L.push('');
    }
    if (d.recent_dialogues?.length) {
        L.push('## 最近 3 条对话摘要');
        for (const dlg of d.recent_dialogues) {
            L.push(`- **${dlg.role}** ${dlg.created_at_rel}：${dlg.content_excerpt}${dlg.signals_summary ? `\n  - 信号：${dlg.signals_summary}` : ''}`);
        }
    }
    L.push('');
    L.push(`---`);
    L.push(`_engine: ${d.engine_version} · 生成于 ${new Date().toISOString()}_`);
    return L.join('\n');
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
    const format = url.searchParams.get('format') === 'markdown' ? 'markdown' : 'json';
    if (!UUID_RE.test(studentId)) return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');

    const sinceIso7 = new Date(Date.now() - 7 * 86400_000).toISOString();

    // 并行拉所有维度数据
    const origin = new URL(req.url).origin;
    const [studentRes, dialoguesRes, attemptsRes, escalationsRes, statesRes, mistakeRes, profileRes] = await Promise.all([
        pgFetch(`/students?id=eq.${studentId}&select=name,grade,stage,created_at,deleted_at&limit=1`),
        pgFetch(`/dialogues?student_id=eq.${studentId}&created_at=gte.${encodeURIComponent(sinceIso7)}&select=role,content,kind,created_at,meta&order=created_at.desc&limit=10`),
        pgFetch(`/attempts?student_id=eq.${studentId}&select=is_correct,submitted_at`),
        pgFetch(`/escalations?student_id=eq.${studentId}&status=eq.pending&select=id,kind,student_message,created_at,expected_response_minutes&order=created_at.desc&limit=5`),
        pgFetch(`/student_states?student_id=eq.${studentId}&select=mastery_score,last_practiced_at,knowledge_points!inner(code,name)&order=mastery_score.asc&limit=5`),
        // 错题图谱直接复用 mistake-graph 端点（避免重复实现聚合逻辑）
        fetch(`${origin}/api/mistake-graph?student_id=${studentId}&days=14`).catch(() => null),
        // 信号画像调 student-memory（已有的 6 字段聚合逻辑）
        fetch(`${origin}/api/student-memory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: studentId, query: '画像', top_k: 1, include_profile: true }),
        }).catch(() => null),
    ]);

    const student = (studentRes.ok ? (await studentRes.json())[0] : null) || {};
    const dialogues = dialoguesRes.ok ? await dialoguesRes.json() : [];
    const allAttempts = attemptsRes.ok ? await attemptsRes.json() : [];
    const escalations = escalationsRes.ok ? await escalationsRes.json() : [];
    const states = statesRes.ok ? await statesRes.json() : [];
    const mistakeData = mistakeRes && mistakeRes.ok ? await mistakeRes.json() : null;
    const profileData = profileRes && profileRes.ok ? await profileRes.json() : null;

    // ─── 学生基本 ───
    const registeredDays = student.created_at ? Math.floor((Date.now() - new Date(student.created_at).getTime()) / 86400_000) : 0;
    const lastActive = dialogues[0]?.created_at;

    // ─── 6 字段画像 ───
    const profile = profileData?.signal_profile || {};

    // ─── 数据栈栏 ───
    const total = allAttempts.length;
    const correct = allAttempts.filter(a => a.is_correct).length;
    const accuracy = total > 0 ? correct / total : 0;
    const dialoguesLast7 = dialogues.length;
    const dateSet7 = new Set();
    for (const a of allAttempts) {
        if (new Date(a.submitted_at) >= new Date(sinceIso7)) {
            dateSet7.add(new Date(a.submitted_at).toISOString().slice(0, 10));
        }
    }

    // ─── weak_kps ───
    const weak_kps = states.map(s => ({
        code: s.knowledge_points?.code,
        name: s.knowledge_points?.name,
        mastery: Number(s.mastery_score) || 0,
        last_practiced_rel: fmtRel(s.last_practiced_at),
    }));

    // ─── mistake_top（前 5）───
    const mistake_top = (mistakeData?.groups || []).slice(0, 5).map(g => ({
        tag: g.tag,
        label: g.label,
        category: g.category,
        count: g.count,
        sample_root_cause: g.sample_root_cause,
    }));

    // ─── recent_dialogues ───
    const recent_dialogues = dialogues.slice(0, 3).map(d => {
        const sig = d.meta?.signals || {};
        const sigSummary = [
            sig.stuck_point && `卡点:${sig.stuck_point}`,
            sig.emotion_state && `情绪:${sig.emotion_state}`,
            sig.cognitive_style && sig.cognitive_style !== 'unknown' && `风格:${sig.cognitive_style}`,
        ].filter(Boolean).join(' · ');
        return {
            role: d.role,
            content_excerpt: (d.content || '').slice(0, 120),
            signals_summary: sigSummary || null,
            created_at_rel: fmtRel(d.created_at),
        };
    });

    // ─── pending escalations ───
    const pending_escalations = escalations.map(e => ({
        id: e.id,
        kind: e.kind,
        student_message: (e.student_message || '').slice(0, 120),
        created_at_rel: fmtRel(e.created_at),
        eta_min: e.expected_response_minutes,
    }));

    // ─── 接班一句话 ───
    const briefParts = [];
    briefParts.push(`${student.name || '同学'} · ${GRADE_CN[student.grade] || '中学生'}`);
    if (profile.cognitive_style && profile.cognitive_style !== 'unknown') {
        briefParts.push(COG_STYLE_CN[profile.cognitive_style] || profile.cognitive_style);
    }
    if (profile.dominant_emotion) briefParts.push(`情绪${profile.dominant_emotion}`);
    if (mistake_top.length) briefParts.push(`最弱「${mistake_top[0].label}」错${mistake_top[0].count}次`);
    if (weak_kps.length) briefParts.push(`mastery 最低 ${weak_kps[0].name} ${Math.round(weak_kps[0].mastery * 100)}%`);
    const mentor_brief = briefParts.join(' · ');

    const dossier = {
        ok: true,
        student: {
            id: studentId,
            name: student.name || null,
            grade: student.grade || null,
            grade_cn: GRADE_CN[student.grade] || null,
            stage: student.stage || null,
            registered_days: registeredDays,
            last_active_at: lastActive,
            last_active_rel: fmtRel(lastActive),
        },
        profile: {
            cognitive_style: profile.cognitive_style || null,
            cognitive_style_confidence: profile.cognitive_style_confidence || 0,
            dominant_emotion: profile.dominant_emotion || null,
            analogy_success_rate: profile.analogy_success_rate ?? null,
            top_stuck_points: (profile.top_stuck_points || []).slice(0, 5),
            top_interests: (profile.top_interests || []).slice(0, 3).map(t => t.keyword || t),
        },
        stats: {
            total_attempts: total,
            correct_attempts: correct,
            accuracy: Number(accuracy.toFixed(2)),
            active_days_last_7: dateSet7.size,
            dialogues_last_7: dialoguesLast7,
            escalations_pending: pending_escalations.length,
        },
        weak_kps,
        mistake_top,
        recent_dialogues,
        pending_escalations,
        mentor_brief,
        engine_version: 'student-dossier-v1.0',
    };

    if (format === 'markdown') {
        const md = renderMarkdown(dossier);
        return new Response(md, {
            status: 200,
            headers: {
                'Content-Type': 'text/markdown; charset=utf-8',
                'Cache-Control': 'private, max-age=30',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
    return jsonResp(dossier);
}
