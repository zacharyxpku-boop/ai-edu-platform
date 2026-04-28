// 原点智学 · /api/cron-parent-push-scan · 4 类家长 push 触发器扫描 cron
//
// 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md 「家长 push 通道（4 类触发）」
// 配套：
//   - api/parent-push.js（落库端点）
//   - db/migrations/0009_parent_pushes.sql（schema + 去重 unique index）
//
// 扫描逻辑（4 类 + crisis）：
//
//   1) emotion_signals · dialogues last 24h
//      WHERE meta->signals->>emotion_state IN ('焦虑','沮丧')  ≥ 2 次/24h
//      → priority=3，文案：「{name}今天表现出焦虑/无力信号 N 次。今晚回家可以听他说说，不用催学习」
//
//   2) escalation_overdue · escalations
//      WHERE status='pending' AND created_at < now() - 60min
//      → priority=2，文案：「{name}有 1 条学长求助等了 60+ 分钟还没人接...」
//
//   3) weekly_brief · 每周日 ≥ 19:00（北京时区）
//      → priority=3，文案：「{name}的本周学习周报已生成。30 秒看懂版：{headline}」
//
//   4) monthly_summary · 每月 1 日 9-10 点
//      → priority=3，文案：「{name}{月}月学习总结。新增掌握 N 个知识点...」
//
//   crisis · escalations kind='crisis' last 24h（兜底，escalate.js 也直接调过 parent-push）
//      → priority=1，立即 push 含心理援助热线
//
// 去重：DB unique (student_id, trigger_kind, day) 兜底
//      → cron 每小时跑一遍也只会落库 1 条/天/学生/类型
//
// 调用方式：
//   POST /api/cron-parent-push-scan
//   Body: { admin_token: "..." }   (校验 ADMIN_TOKEN env)
//   建议 GitHub Action 每小时调一次，定时窗口内才生效（weekly/monthly）

export const config = { runtime: 'edge', maxDuration: 60 };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env)
    ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env)
    ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const ADMIN_TOKEN = (typeof process !== 'undefined' && process.env)
    ? process.env.ADMIN_TOKEN : '';

const ENGINE_VERSION = 'cron-parent-push-scan-v1.0';

const CRISIS_HOTLINE = '北京心理援助热线 010-82951332';

// ---------------------------------------------------------------------------

function jsonResp(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
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

// 北京时间 helpers（cron 容器是 UTC，这里换算到 Asia/Shanghai）
function nowBeijing() {
    const utc = Date.now();
    return new Date(utc + 8 * 3600 * 1000); // 简单 +8h 偏移（够用）
}

function isSundayEveningBJ() {
    const d = nowBeijing();
    // d.getUTCDay() 因为我们手动加了 8h 已经是北京时间, 用 getUTCDay 才对
    return d.getUTCDay() === 0 && d.getUTCHours() >= 19;
}

function isFirstOfMonthMorningBJ() {
    const d = nowBeijing();
    return d.getUTCDate() === 1 && d.getUTCHours() >= 9 && d.getUTCHours() <= 10;
}

function lastMonthLabel() {
    const d = nowBeijing();
    let m = d.getUTCMonth(); // 0-11，本月已 -1
    if (m === 0) m = 12;
    return m;
}

function thisMonthLabel() {
    const d = nowBeijing();
    return d.getUTCMonth() + 1;
}

// 内部调 /api/parent-push 落库（同源 fetch）
async function callParentPush(origin, payload) {
    try {
        const r = await fetch(`${origin}/api/parent-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const j = await r.json().catch(() => ({}));
        return { ok: r.ok && j.ok, status: r.status, body: j };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// ---------------------------------------------------------------------------

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }
    if (req.method !== 'POST') {
        return jsonErr(405, 'method_not_allowed', 'POST only');
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return jsonErr(503, 'not_configured', 'SUPABASE env not set');
    }

    let body;
    try { body = await req.json(); } catch (e) {
        return jsonErr(400, 'bad_json', '请求体不是合法 JSON');
    }
    const adminToken = body?.admin_token || req.headers.get('x-admin-token') || '';
    if (!ADMIN_TOKEN || adminToken !== ADMIN_TOKEN) {
        return jsonErr(401, 'unauthorized', 'admin_token 不匹配');
    }

    const origin = new URL(req.url).origin;
    const startedAt = Date.now();

    // ---- 拉所有 active students ----
    let students = [];
    try {
        const r = await pgFetch('/students?select=id,name&deleted_at=is.null&limit=1000');
        if (!r.ok) {
            return jsonErr(502, 'pg_students_failed', `${r.status}`);
        }
        students = await r.json();
    } catch (e) {
        return jsonErr(502, 'pg_network', e.message);
    }

    const stats = {
        students_scanned: students.length,
        emotion_signals: { hit: 0, sent: 0, deduped: 0, errors: 0 },
        escalation_overdue: { hit: 0, sent: 0, deduped: 0, errors: 0 },
        weekly_brief: { hit: 0, sent: 0, deduped: 0, errors: 0, skipped: !isSundayEveningBJ() },
        monthly_summary: { hit: 0, sent: 0, deduped: 0, errors: 0, skipped: !isFirstOfMonthMorningBJ() },
        crisis: { hit: 0, sent: 0, deduped: 0, errors: 0 },
    };

    // 时间窗口
    const now = new Date();
    const t24hAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const t60minAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // ---- 逐学生扫描 4 类 + crisis ----
    for (const s of students) {
        const name = s.name || '同学';
        const deeplink = `/parent-radar?student_id=${s.id}`;

        // ============= crisis（最高优先级，先跑）=============
        try {
            const r = await pgFetch(
                `/escalations?student_id=eq.${s.id}&kind=eq.crisis&created_at=gte.${t24hAgo}&select=id,created_at&limit=5`
            );
            if (r.ok) {
                const arr = await r.json();
                if (arr.length > 0) {
                    stats.crisis.hit += 1;
                    const res = await callParentPush(origin, {
                        student_id: s.id,
                        trigger_kind: 'crisis',
                        title: `[紧急] ${name}需要立即关心`,
                        body: `${name}今天的对话出现危机信号 · 平台已联系学长立即介入 · 你也可以打这个电话：${CRISIS_HOTLINE} · 现在请放下手头的事`,
                        deeplink,
                        meta: { escalation_ids: arr.map(x => x.id), hotline: CRISIS_HOTLINE },
                    });
                    if (res.ok) {
                        if (res.body?.deduped) stats.crisis.deduped += 1;
                        else stats.crisis.sent += 1;
                    } else {
                        stats.crisis.errors += 1;
                    }
                }
            }
        } catch (e) {
            stats.crisis.errors += 1;
        }

        // ============= emotion_signals · 24h 内 ≥ 2 次焦虑/沮丧 =============
        try {
            // dialogues.meta->signals->>emotion_state IN ('焦虑','沮丧')
            // PostgREST 操作符：jsonb path 用 -> 取，文本比较走 ?? 不方便，用 ilike on text 兜底
            // 这里用 cs (contains) 写 jsonb 子集匹配
            const r1 = await pgFetch(
                `/dialogues?student_id=eq.${s.id}&created_at=gte.${t24hAgo}` +
                `&meta->signals->>emotion_state=eq.焦虑&select=id&limit=10`
            );
            const r2 = await pgFetch(
                `/dialogues?student_id=eq.${s.id}&created_at=gte.${t24hAgo}` +
                `&meta->signals->>emotion_state=eq.沮丧&select=id&limit=10`
            );
            const c1 = r1.ok ? (await r1.json()).length : 0;
            const c2 = r2.ok ? (await r2.json()).length : 0;
            const total = c1 + c2;
            if (total >= 2) {
                stats.emotion_signals.hit += 1;
                const res = await callParentPush(origin, {
                    student_id: s.id,
                    trigger_kind: 'emotion_signals',
                    title: `${name}今天有些不太好`,
                    body: `${name}今天表现出焦虑/无力信号 ${total} 次 · 今晚回家可以听他说说，不用催学习 · 我们已让学长留意`,
                    deeplink,
                    meta: { window_h: 24, anxiety_count: c1, frustration_count: c2, total },
                });
                if (res.ok) {
                    if (res.body?.deduped) stats.emotion_signals.deduped += 1;
                    else stats.emotion_signals.sent += 1;
                } else {
                    stats.emotion_signals.errors += 1;
                }
            }
        } catch (e) {
            stats.emotion_signals.errors += 1;
        }

        // ============= escalation_overdue · pending > 60min =============
        try {
            const r = await pgFetch(
                `/escalations?student_id=eq.${s.id}&status=eq.pending` +
                `&created_at=lt.${t60minAgo}&select=id,kind,created_at&order=created_at.asc&limit=5`
            );
            if (r.ok) {
                const arr = await r.json();
                if (arr.length > 0) {
                    stats.escalation_overdue.hit += 1;
                    const oldestMin = Math.round(
                        (now.getTime() - new Date(arr[0].created_at).getTime()) / 60000
                    );
                    const res = await callParentPush(origin, {
                        student_id: s.id,
                        trigger_kind: 'escalation_overdue',
                        title: `${name}的学长求助等了 ${oldestMin} 分钟`,
                        body: `${name}有 ${arr.length} 条学长求助等了 ${oldestMin}+ 分钟还没人接 · 我们正在协调，预计 30 分钟内有回复`,
                        deeplink,
                        meta: { escalation_ids: arr.map(x => x.id), oldest_minutes: oldestMin, count: arr.length },
                    });
                    if (res.ok) {
                        if (res.body?.deduped) stats.escalation_overdue.deduped += 1;
                        else stats.escalation_overdue.sent += 1;
                    } else {
                        stats.escalation_overdue.errors += 1;
                    }
                }
            }
        } catch (e) {
            stats.escalation_overdue.errors += 1;
        }

        // ============= weekly_brief · 周日 ≥ 19:00 =============
        if (!stats.weekly_brief.skipped) {
            try {
                stats.weekly_brief.hit += 1;
                // 拉一句 headline（调 parent-brief 拿 deterministic）
                let headline = '本周学习数据已就绪';
                try {
                    const br = await fetch(
                        `${origin}/api/parent-brief?student_id=${s.id}&period=weekly`,
                        { headers: { 'Accept': 'application/json' } }
                    );
                    if (br.ok) {
                        const bj = await br.json();
                        if (bj?.headline) headline = String(bj.headline).slice(0, 100);
                    }
                } catch (e) { /* 忽略 · 用默认 headline */ }

                const res = await callParentPush(origin, {
                    student_id: s.id,
                    trigger_kind: 'weekly_brief',
                    title: `${name}的本周学习周报`,
                    body: `${name}的本周学习周报已生成 · 30 秒看懂版：${headline}`,
                    deeplink,
                    meta: { week_ending: now.toISOString().slice(0, 10) },
                });
                if (res.ok) {
                    if (res.body?.deduped) stats.weekly_brief.deduped += 1;
                    else stats.weekly_brief.sent += 1;
                } else {
                    stats.weekly_brief.errors += 1;
                }
            } catch (e) {
                stats.weekly_brief.errors += 1;
            }
        }

        // ============= monthly_summary · 每月 1 日 9-10 点 =============
        if (!stats.monthly_summary.skipped) {
            try {
                stats.monthly_summary.hit += 1;
                const lastMon = lastMonthLabel();
                const thisMon = thisMonthLabel();

                // 简单数：上月攻克 KP 数量（mastery 从 < 0.6 升到 >= 0.7）
                // demo 阶段先用 placeholder，正式版接 student_states.history
                const res = await callParentPush(origin, {
                    student_id: s.id,
                    trigger_kind: 'monthly_summary',
                    title: `${name}${lastMon}月学习总结`,
                    body: `${name}${lastMon}月学习总结已出 · 月报里有：新增掌握的知识点、最弱点、${thisMon}月建议聚焦 · 30 秒看懂`,
                    deeplink,
                    meta: { last_month: lastMon, this_month: thisMon },
                });
                if (res.ok) {
                    if (res.body?.deduped) stats.monthly_summary.deduped += 1;
                    else stats.monthly_summary.sent += 1;
                } else {
                    stats.monthly_summary.errors += 1;
                }
            } catch (e) {
                stats.monthly_summary.errors += 1;
            }
        }
    }

    const elapsed = Date.now() - startedAt;
    return jsonResp({
        ok: true,
        engine_version: ENGINE_VERSION,
        elapsed_ms: elapsed,
        beijing_now: nowBeijing().toISOString(),
        is_sunday_evening: isSundayEveningBJ(),
        is_first_of_month_morning: isFirstOfMonthMorningBJ(),
        stats,
    });
}
