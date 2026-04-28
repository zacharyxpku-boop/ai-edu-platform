// 原点智学 · /api/moderation · 不当内容审核层（Khanmigo 5.5 安全机制对齐）
//
// POST 检测一段 content（学生消息 or AI 输出），返回 verdict + flags + actions
//
// 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md 安全审核域
//   T6 escalations 只覆盖学生说严重伤害自己的话（crisis）。
//   moderation 补全 Khanmigo 5.5 缺的：脏话/跑题/作弊/AI hallucination
//
// schema：db/migrations/0010_moderation_logs.sql
//
// 入参：
//   { student_id, dialogue_id?, role:'student'|'tutor', content, context? }
// 出参：
//   { ok, moderation_id, verdict, flags:[{category,severity,snippet}], actions_taken:[...] }
//
// 检测策略：纯启发式（关键词正则），不调 LLM（成本/延迟/隐私三方面考虑）

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// 6 类 flag 关键词词典
// ---------------------------------------------------------------------------

// 1. profanity 脏话（学生侧）
//    命中 1 词 severity=2，命中 2+ severity=4
const PROFANITY_WORDS = ['操', '妈的', '草', 'tmd', '滚', '傻逼', 'sb', 'fuck', 'shit'];

// 2. harm 自伤 / 暴力（学生侧 · 命中即 severity=5 → escalate kind=crisis）
const HARM_WORDS = ['想死', '自杀', '伤害自己', '打人', '杀'];

// 3. adult 色情 / 不当内容（学生侧 · 暂时词典空，留扩展位）
//    K12 学生场景词典需谨慎选词避免误伤（如「成人」「身体」是正常用词）
//    生产环境建议接入 Tencent COS / Aliyun 内容安全 API
const ADULT_WORDS = [];

// 4. off_topic 严重跑题（学生侧 · severity=2 flag）
const OFF_TOPIC_WORDS = ['抖音', '游戏推荐', '小说', '约你', '加我微信', '发红包'];

// 5. cheating 作弊（学生侧 · severity=2 flag · v3 prompt 已处理但要 log）
const CHEATING_PHRASES = ['答案给我', '直接说答案', '帮我做完', '抄一下'];

// 6a. hallucination 启发式（AI 侧 · severity=3 flag）
//     输出含具体年份 / 「根据xxx研究」/ 「某权威」/ 「官方数据」
const HALLUCINATION_RE = /(\d{4}\s*年|根据.{0,10}研究|某权威|官方数据)/;

// 6b. policy_violation（AI 侧 · v3 prompt 全局禁词 · severity=2 flag）
//     这些是 v3 prompt 明确禁用的，AI 不该出
const POLICY_VIOLATION_WORDS = ['赋能', '智能化', '加油', '你能行', '真棒', '你聪明'];

// ---------------------------------------------------------------------------
// detectFlags · 启发式检测，返回 flags[]
// ---------------------------------------------------------------------------
function detectFlags(role, content) {
    const flags = [];
    const text = String(content || '');
    const lower = text.toLowerCase();

    if (role === 'student') {
        // ---- 1. profanity ----
        const profHits = PROFANITY_WORDS.filter(w => lower.includes(w.toLowerCase()));
        if (profHits.length > 0) {
            flags.push({
                category: 'profanity',
                severity: profHits.length >= 2 ? 4 : 2,
                snippet: profHits.join('/'),
            });
        }

        // ---- 2. harm（最高优先级，命中即 severity=5）----
        const harmHit = HARM_WORDS.find(w => text.includes(w));
        if (harmHit) {
            flags.push({
                category: 'harm',
                severity: 5,
                snippet: harmHit,
            });
        }

        // ---- 3. adult（暂留位）----
        const adultHit = ADULT_WORDS.find(w => text.includes(w));
        if (adultHit) {
            flags.push({
                category: 'adult',
                severity: 4,
                snippet: adultHit,
            });
        }

        // ---- 4. off_topic ----
        const offTopicHit = OFF_TOPIC_WORDS.find(w => text.includes(w));
        if (offTopicHit) {
            flags.push({
                category: 'off_topic',
                severity: 2,
                snippet: offTopicHit,
            });
        }

        // ---- 5. cheating ----
        const cheatHit = CHEATING_PHRASES.find(w => text.includes(w));
        if (cheatHit) {
            flags.push({
                category: 'cheating',
                severity: 2,
                snippet: cheatHit,
            });
        }
    } else if (role === 'tutor') {
        // ---- 6a. hallucination ----
        const halluMatch = text.match(HALLUCINATION_RE);
        if (halluMatch) {
            flags.push({
                category: 'misinformation',
                severity: 3,
                snippet: halluMatch[0].slice(0, 30),
            });
        }

        // ---- 6b. policy_violation ----
        const policyHit = POLICY_VIOLATION_WORDS.find(w => text.includes(w));
        if (policyHit) {
            flags.push({
                category: 'policy_violation',
                severity: 2,
                snippet: policyHit,
            });
        }
    }

    return flags;
}

// ---------------------------------------------------------------------------
// computeVerdict · flags → verdict
// ---------------------------------------------------------------------------
function computeVerdict(flags) {
    if (flags.length === 0) return 'clean';
    const maxSev = Math.max(...flags.map(f => f.severity));
    const hasHarm = flags.some(f => f.category === 'harm');

    // harm 类直接 escalate（无视 severity 数值）
    if (hasHarm) return 'escalate';

    if (maxSev >= 5) return 'escalate';
    if (maxSev >= 4) return 'escalate';  // severity ≥ 4 → escalate（alert_parent 走 escalate 通道）
    if (maxSev >= 1) return 'flag';
    return 'clean';
}

// ---------------------------------------------------------------------------
// computeActions · verdict + flags + role → actions_taken[]
// ---------------------------------------------------------------------------
function computeActions(verdict, flags, role) {
    const actions = ['logged'];  // 永远 log
    const maxSev = flags.length ? Math.max(...flags.map(f => f.severity)) : 0;

    if (verdict === 'escalate' || maxSev >= 4) {
        actions.push('alert_parent');  // 走 /api/escalate kind=crisis 或 kind=manual
    }

    // block_response 当前版本不实现（注释保留意图）
    // if (role === 'tutor' && verdict === 'block') actions.push('block_response');

    return actions;
}

// ---------------------------------------------------------------------------
// HTTP helpers
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

// ---------------------------------------------------------------------------
// runModeration · 共享逻辑（POST handler + escalate.js 内部直调都用这个）
// ---------------------------------------------------------------------------
export async function runModeration({ student_id, dialogue_id, role, content, context = {} }) {
    const safeContent = String(content || '').slice(0, 5000);
    const excerpt = safeContent.slice(0, 500);

    const flags = detectFlags(role, safeContent);
    const verdict = computeVerdict(flags);
    const actions = computeActions(verdict, flags, role);

    // 写 moderation_logs（即便 verdict=clean 也写，保留全审计轨迹用于后续 prompt 调优）
    let moderationId = null;
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY && student_id && UUID_RE.test(student_id)) {
        try {
            const r = await pgFetch('/moderation_logs', {
                method: 'POST',
                headers: { 'Prefer': 'return=representation' },
                body: JSON.stringify({
                    student_id,
                    dialogue_id: dialogue_id && UUID_RE.test(dialogue_id) ? dialogue_id : null,
                    role,
                    content_excerpt: excerpt,
                    verdict,
                    flags,
                    actions_taken: actions,
                }),
            });
            if (r.ok) {
                const arr = await r.json();
                moderationId = (Array.isArray(arr) ? arr[0] : arr)?.id || null;
            }
        } catch (e) {
            // 写库失败不阻塞 verdict 返回（审核结果比 log 重要）
        }
    }

    return {
        moderation_id: moderationId,
        verdict,
        flags,
        actions_taken: actions,
    };
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------
export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'content-type',
            },
        });
    }

    if (req.method !== 'POST') {
        return jsonErr(405, 'method_not_allowed', 'POST only');
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return jsonErr(400, 'bad_json', '请求体不是合法 JSON');
    }

    const { student_id, dialogue_id, role, content, context } = body || {};

    if (!role || !['student', 'tutor'].includes(role)) {
        return jsonErr(400, 'bad_role', "role 必须是 'student' 或 'tutor'");
    }
    if (!content || typeof content !== 'string') {
        return jsonErr(400, 'bad_content', 'content 必填且必须是字符串');
    }
    if (student_id && !UUID_RE.test(student_id)) {
        return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');
    }

    const result = await runModeration({ student_id, dialogue_id, role, content, context });

    return jsonResp({
        ok: true,
        ...result,
        engine_version: 'moderation-v1.0',
    });
}
