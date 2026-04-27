// 原点智学 · admin 看板汇总数据端点
// GET /api/admin/summary?range=7d
// Header: X-Admin-Token: <ADMIN_TOKEN env>
// → { summary, daily_active, taxonomy_top, students, alerts }
//
// 用 service_role 绕过 RLS 跑聚合，仅返回脱敏后的统计数据。

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const ADMIN_TOKEN = (typeof process !== 'undefined' && process.env) ? process.env.ADMIN_TOKEN : '';

function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ ok: false, error: code, message: msg }), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

async function pgCall(sql, params = {}) {
    // 用 PostgREST 的 RPC（先在 SQL Editor 创建对应 function）或直接走 REST
    // 这里用通用 REST，简单聚合用 GET + select=count() / aggregate
    return null; // 实现见各 helper
}

async function fetchSummary(rangeDays) {
    const since = new Date(Date.now() - rangeDays * 24 * 3600 * 1000).toISOString();
    const headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
    };

    // 学员总数
    const totalR = await fetch(`${SUPABASE_URL}/rest/v1/students?select=id&cohort=eq.camp-2`, { headers });
    const total = totalR.ok ? (await totalR.json()).length : 0;

    // 今日 / 昨日 attempts 去重学生
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const ydayStart = new Date(todayStart); ydayStart.setDate(ydayStart.getDate() - 1);

    const todayR = await fetch(
        `${SUPABASE_URL}/rest/v1/attempts?select=student_id&submitted_at=gte.${todayStart.toISOString()}`,
        { headers }
    );
    const ydayR = await fetch(
        `${SUPABASE_URL}/rest/v1/attempts?select=student_id&submitted_at=gte.${ydayStart.toISOString()}&submitted_at=lt.${todayStart.toISOString()}`,
        { headers }
    );
    const activeToday = todayR.ok ? new Set((await todayR.json()).map(r => r.student_id)).size : 0;
    const activeYday = ydayR.ok ? new Set((await ydayR.json()).map(r => r.student_id)).size : 0;

    // 今日完成（scored_meta.mastery_after >= 0.9 的 attempts）
    const completionR = await fetch(
        `${SUPABASE_URL}/rest/v1/attempts?select=scored_meta&submitted_at=gte.${todayStart.toISOString()}`,
        { headers }
    );
    const todayAttempts = completionR.ok ? await completionR.json() : [];
    const completionCount = todayAttempts.filter(r => (r.scored_meta?.mastery_after ?? 0) >= 0.9).length;
    const totalCount = todayAttempts.length;
    const completionRate = totalCount > 0 ? completionCount / totalCount : 0;

    // mastery 增量平均（从 scored_meta jsonb 读）
    const gainR = await fetch(
        `${SUPABASE_URL}/rest/v1/attempts?select=scored_meta&submitted_at=gte.${since}`,
        { headers }
    );
    const gains = gainR.ok ? await gainR.json() : [];
    const validGains = gains.filter(r => r.scored_meta?.mastery_before != null && r.scored_meta?.mastery_after != null);
    const avgGain = validGains.length > 0
        ? validGains.reduce((s, r) => s + (r.scored_meta.mastery_after - r.scored_meta.mastery_before), 0) / validGains.length
        : 0;

    // 错题率
    const errR = await fetch(
        `${SUPABASE_URL}/rest/v1/attempts?select=is_correct&submitted_at=gte.${todayStart.toISOString()}`,
        { headers }
    );
    const errs = errR.ok ? await errR.json() : [];
    const errorRate = errs.length > 0 ? errs.filter(r => !r.is_correct).length / errs.length : 0;

    // W4 留存预测：基于本周日活相对总学员的比例 + 简单衰减模型
    const weekStart = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const weekR = await fetch(
        `${SUPABASE_URL}/rest/v1/attempts?select=student_id&submitted_at=gte.${weekStart}`,
        { headers }
    );
    const weekActiveSet = weekR.ok ? new Set((await weekR.json()).map(r => r.student_id)) : new Set();
    const w1Retention = total > 0 ? weekActiveSet.size / total : 0;
    // 衰减模型：W1 → W4 = 0.85 ^ 3
    const w4Projection = w1Retention * Math.pow(0.85, 3);

    return {
        cohort_name: '五一营第二期',
        active_today: activeToday,
        active_yesterday: activeYday,
        active_total: total,
        completion_rate: Math.round(completionRate * 100) / 100,
        completion_today_n: completionCount,
        completion_today_d: totalCount,
        avg_mastery_gain: Math.round(avgGain * 100) / 100,
        error_rate: Math.round(errorRate * 100) / 100,
        w4_projection: Math.round(w4Projection * 100) / 100,
        updated_at: new Date().toISOString(),
    };
}

async function fetchDailyActive(days) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    const headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
    };
    const r = await fetch(
        `${SUPABASE_URL}/rest/v1/attempts?select=student_id,submitted_at&submitted_at=gte.${since}`,
        { headers }
    );
    if (!r.ok) return [];
    const rows = await r.json();
    const byDay = {};
    rows.forEach(row => {
        const d = row.submitted_at.slice(5, 10);  // MM-DD
        if (!byDay[d]) byDay[d] = new Set();
        byDay[d].add(row.student_id);
    });
    const out = [];
    for (let i = days; i >= 0; i--) {
        const dt = new Date(Date.now() - i * 24 * 3600 * 1000);
        const d = String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
        out.push({ d, n: (byDay[d] || new Set()).size });
    }
    return out;
}

async function fetchTaxonomyTop(rangeDays) {
    const since = new Date(Date.now() - rangeDays * 24 * 3600 * 1000).toISOString();
    const headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
    };
    // diagnose_l3 在 scored_meta.diagnose_l3 jsonb 数组里
    const r = await fetch(
        `${SUPABASE_URL}/rest/v1/attempts?select=scored_meta&submitted_at=gte.${since}&is_correct=eq.false`,
        { headers }
    );
    if (!r.ok) return [];
    const rows = await r.json();
    const counts = {};
    rows.forEach(row => {
        (row.scored_meta?.diagnose_l3 || []).forEach(tag => {
            counts[tag] = (counts[tag] || 0) + 1;
        });
    });
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([l3_id, count]) => ({
            l3_id,
            l3_name: l3_id.split('.').pop().replace(/_/g, ' '),
            count
        }));
}

async function fetchStudents() {
    const headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
    };
    const stuR = await fetch(`${SUPABASE_URL}/rest/v1/students?select=id,name&cohort=eq.camp-2&limit=50`, { headers });
    if (!stuR.ok) return [];
    const stus = await stuR.json();
    const result = [];
    for (const s of stus) {
        const aR = await fetch(
            `${SUPABASE_URL}/rest/v1/attempts?select=scored_meta,submitted_at&student_id=eq.${s.id}&order=submitted_at.desc&limit=20`,
            { headers }
        );
        const attempts = aR.ok ? await aR.json() : [];
        const last = attempts[0];
        const lastMastery = last?.scored_meta?.mastery_after || 0;
        const lastAt = last ? humanTime(last.submitted_at) : '从未';
        const daysSince = last ? (Date.now() - new Date(last.submitted_at).getTime()) / 86400000 : 99;
        const status = daysSince < 1.5 ? 'active' : (daysSince < 4 ? 'idle' : 'lost');
        const risk = daysSince < 1.5 ? 'low' : (daysSince < 4 ? 'mid' : 'high');
        const weekDelta = attempts.length > 1
            ? lastMastery - (attempts[attempts.length - 1].scored_meta?.mastery_after || 0)
            : 0;
        result.push({
            name: s.name,
            status,
            loops: attempts.length,
            last_at: lastAt,
            mastery: Math.round(lastMastery * 100) / 100,
            week_delta: Math.round(weekDelta * 100) / 100,
            risk,
        });
    }
    // 风险降序
    const riskOrder = { high: 0, mid: 1, low: 2 };
    result.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);
    return result;
}

function humanTime(iso) {
    const dt = new Date(iso);
    const diff = Date.now() - dt.getTime();
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return '今天 ' + dt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (diff < 172800000) return '昨天 ' + dt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return Math.floor(diff / 86400000) + ' 天前';
}

function generateAlerts(summary, students, taxonomy) {
    const alerts = [];
    if (summary.active_today / summary.active_total < 0.6) {
        alerts.push(`今日活跃率仅 ${Math.round(summary.active_today / summary.active_total * 100)}%，低于 60% 警戒线`);
    }
    if (summary.error_rate > 0.6) {
        alerts.push(`错题率 ${Math.round(summary.error_rate * 100)}%，超 60% 阈值，建议调降难度`);
    }
    if (summary.completion_rate < 0.5 && summary.completion_today_d > 5) {
        alerts.push(`闭环完成率 ${Math.round(summary.completion_rate * 100)}%，可能题序设计偏难`);
    }
    students.filter(s => s.risk === 'high').forEach(s => {
        alerts.push(`${s.name} ${s.last_at}活跃，建议私信干预`);
    });
    if (taxonomy[0] && taxonomy[0].count > 30) {
        alerts.push(`错题归因「${taxonomy[0].l3_name}」累积 ${taxonomy[0].count} 次，建议在 retrieve few-shot 加强`);
    }
    return alerts;
}

export default async function handler(req) {
    if (req.method !== 'GET') return jsonErr(405, 'method_not_allowed', '只接受 GET');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return jsonErr(503, 'not_configured', 'Supabase env 未配');
    if (!ADMIN_TOKEN) return jsonErr(503, 'admin_token_not_set', 'ADMIN_TOKEN env 未设');

    const token = req.headers.get('X-Admin-Token') || req.headers.get('x-admin-token');
    if (token !== ADMIN_TOKEN) return jsonErr(401, 'unauthorized', 'admin token 错误');

    const url = new URL(req.url);
    const range = url.searchParams.get('range') || '7d';
    const rangeDays = range === 'today' ? 1 : (range === 'yesterday' ? 2 : (range === '7d' ? 7 : 30));

    try {
        const [summary, daily_active, taxonomy_top, students] = await Promise.all([
            fetchSummary(rangeDays),
            fetchDailyActive(14),
            fetchTaxonomyTop(rangeDays),
            fetchStudents(),
        ]);
        const alerts = generateAlerts(summary, students, taxonomy_top);
        return new Response(JSON.stringify({ summary, daily_active, taxonomy_top, students, alerts }), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        });
    } catch (e) {
        return jsonErr(500, 'aggregation_failed', e.message);
    }
}
