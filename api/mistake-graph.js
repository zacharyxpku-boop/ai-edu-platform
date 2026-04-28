// 原点智学 · /api/mistake-graph · 错题本自动归类（按 64 类 misconception 聚合）
//
// GET ?student_id=<uuid>&days=7|30
//
// 学校老师不可能给每个学生维护这种图谱。这是 1 对 1 工业化的杠杆点。
// 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md 三件套之「错题本」
//
// 数据来源：attempts.scored_meta.diagnose_l3 JSONB 数组（mastery-loop 答错时
// /api/diagnose 返回的 l3_tag 数组已经持久化）。这一层不再依赖 misconceptions
// 表的预定义条目——l3_tag 字符串本身就是 64 类标签的稳定 key。
//
// 输出：
// {
//   ok: true,
//   window_days: 7,
//   total_wrong: 24,
//   groups: [
//     {
//       tag: "ability.skipped_step.move_term",        // l3 标签原始字符串
//       label: "移项忘记变号",                         // 人话
//       category: "ability",                            // l1 大类
//       count: 7,                                       // 该 tag 错过几次
//       last_at: "2026-04-28T18:30:00Z",
//       last_at_rel: "2 小时前",
//       kps: ["math.7.ch3.kp3", "math.7.ch3.kp4"],     // 涉及哪些 KP
//       sample_root_cause: "把 +5 移到右边时没改成 -5"  // 取最近一次的 root_cause
//     },
//     ...按 count 降序
//   ],
//   by_category: { knowledge: 3, ability: 12, metacog: 2, careless: 7 }
// }
//
// 前端用法：parent-radar 加「错题图谱」section，按类聚合可视化。
// 学生用法：mastery-loop 完成态加「看本周错题图谱」入口。
// 学长用法：escalation context 自动塞这份图谱（学长 30 秒看到孩子 7 天卡哪几类）。

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// l3 tag 人话翻译（核心 30 个 · 不全是 64 但覆盖最常见）
// 命名规则：category.subtype.specific（跟 retrieve.js 64 类对齐）
const L3_LABEL = {
    // ─── knowledge · 概念性错误 ───
    'knowledge.definition.unclear': '概念定义模糊',
    'knowledge.property.misuse': '性质用错（比如等式两边不能除以零）',
    'knowledge.formula.wrong': '公式记错',
    'knowledge.relationship.confused': '概念关系搞混（如方程 vs 等式）',
    // ─── ability · 能力性错误 ───
    'ability.skipped_step.move_term': '移项忘记变号',
    'ability.skipped_step.distribute': '去括号漏分配',
    'ability.skipped_step.combine': '合并同类项漏并',
    'ability.skipped_step.denominator': '去分母漏乘整式项',
    'ability.calculation.sign': '符号计算（正负号错）',
    'ability.calculation.fraction': '分数计算',
    'ability.calculation.power': '乘方计算',
    'ability.equation_solving.move': '解方程·移项不当',
    'ability.equation_solving.divide': '解方程·两边同除',
    // ─── metacog · 元认知错误 ───
    'metacog.no_check': '没代回原式验证',
    'metacog.no_estimate': '没估算合理性',
    'metacog.no_understand_problem': '审题没读完整',
    'metacog.give_up_too_fast': '没尝试就放弃',
    // ─── careless · 粗心 ───
    'careless.copy_wrong': '抄错数字/符号',
    'careless.sign_drop': '漏符号',
    'careless.unit_drop': '漏单位',
    'careless.misread': '看错题',
    // ─── reading · 审题 ───
    'reading.misunderstand': '理解题意偏差',
    'reading.miss_condition': '漏条件',
    // ─── language ───
    'language.translation': '文字→数学语言转换错',
};

function jsonResp(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'private, max-age=30',
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
    return `${Math.round(diffMin / 1440)} 天前`;
}

function categoryOf(tag) {
    return (tag || '').split('.')[0] || 'unknown';
}

function labelOf(tag) {
    if (L3_LABEL[tag]) return L3_LABEL[tag];
    // 没映射的 tag · 把 . 去掉 + 下划线变空格 · 兜底
    const parts = (tag || '').split('.');
    const last = parts[parts.length - 1] || tag;
    return last.replace(/_/g, ' ');
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
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '7'), 1), 90);
    if (!UUID_RE.test(studentId)) return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');

    const sinceIso = new Date(Date.now() - days * 86400 * 1000).toISOString();

    // 拉错题：is_correct=false + 时间窗
    const sel = encodeURIComponent('id,submitted_at,is_correct,response,scored_meta,knowledge_point_ids');
    const pgUrl = `${SUPABASE_URL}/rest/v1/attempts?student_id=eq.${studentId}` +
        `&is_correct=eq.false&submitted_at=gte.${encodeURIComponent(sinceIso)}` +
        `&select=${sel}&order=submitted_at.desc&limit=500`;

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

    // 聚合：按每条 attempt 的 scored_meta.diagnose_l3 数组展开计数
    const tagMap = new Map(); // tag → { count, last_at, kps_set, root_causes[] }
    const categoryCount = {};
    let totalWrong = 0;

    for (const row of rows) {
        totalWrong++;
        const meta = row.scored_meta || {};
        const tags = Array.isArray(meta.diagnose_l3) ? meta.diagnose_l3 : [];
        const rootCause = meta.root_cause || '';
        const kps = Array.isArray(row.knowledge_point_ids) ? row.knowledge_point_ids : [];

        for (const tag of tags) {
            if (!tag || typeof tag !== 'string') continue;
            const cat = categoryOf(tag);
            categoryCount[cat] = (categoryCount[cat] || 0) + 1;

            if (!tagMap.has(tag)) {
                tagMap.set(tag, {
                    tag,
                    category: cat,
                    label: labelOf(tag),
                    count: 0,
                    last_at: row.submitted_at,
                    kps_set: new Set(),
                    sample_root_cause: rootCause || null,
                });
            }
            const entry = tagMap.get(tag);
            entry.count++;
            // last_at 已经按 desc 排序，第一条就是最新 · 不重新比较
            for (const kp of kps) entry.kps_set.add(kp);
            if (!entry.sample_root_cause && rootCause) entry.sample_root_cause = rootCause;
        }
    }

    const groups = Array.from(tagMap.values())
        .map(g => ({
            tag: g.tag,
            label: g.label,
            category: g.category,
            count: g.count,
            last_at: g.last_at,
            last_at_rel: fmtRel(g.last_at),
            kps: Array.from(g.kps_set).slice(0, 5),
            sample_root_cause: g.sample_root_cause ? String(g.sample_root_cause).slice(0, 100) : null,
        }))
        .sort((a, b) => b.count - a.count);

    // 顶部建议：取错最多的 1-2 类，给「下周聚焦」建议
    const top_focus = groups.slice(0, 2).map(g => g.label);

    return jsonResp({
        ok: true,
        student_id: studentId,
        window_days: days,
        total_wrong: totalWrong,
        groups,
        by_category: categoryCount,
        top_focus,
        engine_version: 'mistake-graph-v1.0',
    });
}
