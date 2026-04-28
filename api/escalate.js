// 原点智学 · /api/escalate · 学生升级到真人辅导队列
//
// POST 创建一条 escalation（学生显式呼叫 / AI prompt 检测后台触发 / mastery-loop 答错 3 次自动）
// GET ?student_id=xxx 列学生自己的 escalation 历史（前端右栏「呼叫记录」用）
//
// 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md 三档分诊
// schema：db/migrations/0007_escalations.sql

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// T1-T7 全分诊：concept(T1/T2) cross_chapter(T3) planning(T4) emotion(T5) crisis(T6) out_of_scope(T7) + 旧 streak/manual
const VALID_KINDS = ['concept', 'emotion', 'streak_3_wrong', 'planning', 'manual', 'cross_chapter', 'crisis', 'out_of_scope'];

// T6 危机资源（最高优先级，回复给学生时直接给可拨打的电话）
const CRISIS_RESOURCES = [
    '北京心理援助热线 010-82951332',
    '生命热线 400-161-9995',
    '北京24小时危机干预热线 010-82951332',
];

// ---------------------------------------------------------------------------
// detectTrigger · 基于学生消息文本 + recent_history 自动判断 T1-T7
// ---------------------------------------------------------------------------
// 入参：
//   message       string  · 学生本轮消息
//   recentHistory array   · [{role:'user'|'assistant', content:'...'}, ...] 最近 N 轮
// 出参：
//   { trigger:'T1'..'T7'|'manual', kind:'concept'|..., confidence:0.0-1.0, reason:'命中词' }
//
// 优先级（同条消息可能命中多类，按下面顺序短路返回）：
//   T6 crisis  > T5 emotion > T2 concept(why) > T4 planning > T3 cross_chapter > T7 out_of_scope > manual
function detectTrigger(message, recentHistory = []) {
    const msg = (message || '').toLowerCase();
    const histArr = Array.isArray(recentHistory) ? recentHistory : [];

    // ---- T6 危机（最高优先级，绝不放过）----
    const crisisPatterns = [
        '想死', '不想活', '活不下去', '活着没意思', '自杀', '伤害自己', '割腕', '跳楼',
        '一了百一', '一了百了', '没意义', '解脱', '消失算了', '不想存在',
        '家里打我', '爸爸打我', '妈妈打我', '被打',
    ];
    for (const p of crisisPatterns) {
        if (msg.includes(p)) {
            return { trigger: 'T6', kind: 'crisis', confidence: 0.95, reason: `crisis:${p}` };
        }
    }

    // ---- T5 情绪挫败（连续 3 轮负面信号）----
    const emotionPatterns = [
        '学不会', '我太蠢', '我就是不行', '我太差', '我没用', '我是废物', '废物',
        '不想学', '学不进去', '烦死了', '崩溃', '放弃了', '完蛋', '我是不是太笨',
    ];
    const emoUserHist = histArr.filter(h => (h.role === 'user' || !h.role)
        && emotionPatterns.some(p => (h.content || '').includes(p))).length;
    const emoNow = emotionPatterns.find(p => msg.includes(p));
    if (emoNow && emoUserHist >= 2) {
        // 累计 ≥ 3 轮（hist 2 + 当前 1）才升级
        return { trigger: 'T5', kind: 'emotion', confidence: 0.85, reason: `emotion×${emoUserHist + 1}:${emoNow}` };
    }

    // ---- T2 概念追问（连续 2 个"为什么"追问底层）----
    const whyRe = /为什么|为啥|凭啥|凭什么|怎么就|怎么会/;
    const whyHistCount = histArr.filter(h => (h.role === 'user' || !h.role) && whyRe.test(h.content || '')).length;
    if (whyHistCount >= 1 && (whyRe.test(msg) || /本质|原理|底层|凭什么/.test(msg))) {
        return { trigger: 'T2', kind: 'concept', confidence: 0.75, reason: `why×${whyHistCount + 1}` };
    }

    // ---- T1 方法论失败（AI 已尝试 ≥2 种讲法 + 学生仍说没懂）----
    // 启发式：history 里 assistant ≥ 2 条 + 当前消息含「没懂/不会/还是不顺」
    const aiCount = histArr.filter(h => h.role === 'assistant').length;
    const stillStuck = /(还是.{0,4}没懂|还是.{0,4}不会|还是不顺|没明白|不太懂|没反应过来|跟不上|没听懂)/.test(msg);
    if (aiCount >= 2 && stillStuck) {
        return { trigger: 'T1', kind: 'concept', confidence: 0.70, reason: `ai-tried×${aiCount}+stuck` };
    }

    // ---- T4 长程规划（路径/考试/选科）----
    if (/中考|高考|月考.{0,10}怎么|安排|计划|策略|选科|文理分科|规划|目标校|提分|长期/.test(msg)) {
        return { trigger: 'T4', kind: 'planning', confidence: 0.70, reason: 'planning-keyword' };
    }

    // ---- T3 跨章节整合（涉及 2+ 章节或学科）----
    if (/(为什么.{0,15}和|.{0,5}跟.{0,5}有关|两章|跨学科|这.{0,3}和.{0,3}有.{0,3}关系|和.{0,5}章.{0,5}怎么联系|结合.{0,8}章节)/.test(msg)) {
        return { trigger: 'T3', kind: 'cross_chapter', confidence: 0.65, reason: 'cross-chapter-pattern' };
    }

    // ---- T7 能力边界（竞赛/偏门/超纲）----
    if (/(竞赛|奥数|奥赛|联赛|选拔|偏门|超纲|地方考纲|本地中考特殊|IMO|希望杯|华罗庚)/.test(msg)) {
        return { trigger: 'T7', kind: 'out_of_scope', confidence: 0.70, reason: 'out-of-scope-keyword' };
    }

    // 默认 manual（学生显式呼叫 / 兜底）
    return { trigger: 'manual', kind: 'manual', confidence: 0.50, reason: 'fallback' };
}

// trigger code → 中文名（工单/学生消息用）
const TRIGGER_CN = {
    T1: 'T1 方法论失败',
    T2: 'T2 概念追问',
    T3: 'T3 跨章节整合',
    T4: 'T4 长程规划',
    T5: 'T5 情绪挫败',
    T6: 'T6 危机信号',
    T7: 'T7 能力边界',
    manual: '学生主动呼叫',
};

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

    if (req.method === 'GET') {
        return handleList(req);
    }

    if (req.method === 'POST') {
        return handleCreate(req);
    }

    return jsonErr(405, 'method_not_allowed', 'GET or POST only');
}

async function handleCreate(req) {
    let body;
    try {
        body = await req.json();
    } catch (e) {
        return jsonErr(400, 'bad_json', '请求体不是合法 JSON');
    }

    const {
        student_id,
        kind: kindFromBody,
        student_message,
        context = {},
        ai_summary: aiSummaryFromBody,
        topic_code,
        dialogue_id,
        expected_response_minutes,
        recent_history,  // [{role, content}] 给 detectTrigger 用
    } = body || {};

    // student_id + student_message 必填；kind 可省略（自动判断）
    if (!student_id || !student_message) {
        return jsonErr(400, 'missing_fields', 'student_id + student_message 必填');
    }
    if (!UUID_RE.test(student_id)) {
        return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');
    }

    const safeMsg = String(student_message).slice(0, 2000);
    const safeContext = (typeof context === 'object' && context) ? context : {};

    // ---- T1-T7 自动判断 ----
    // 用户传了 kind → 信任手动覆盖；没传 → detectTrigger 自动判
    let kind, detected;
    if (kindFromBody && VALID_KINDS.includes(kindFromBody)) {
        kind = kindFromBody;
        detected = { trigger: 'manual', kind, confidence: 1.0, reason: 'user-override' };
    } else if (kindFromBody && !VALID_KINDS.includes(kindFromBody)) {
        return jsonErr(400, 'bad_kind', `kind 必须是 ${VALID_KINDS.join('/')} 之一`);
    } else {
        detected = detectTrigger(safeMsg, recent_history || safeContext.recent_history || []);
        kind = detected.kind;
    }

    // ---- T6 crisis 特殊处理 ----
    // priority 强制 1，ETA 强制 5 分钟，context 注入 crisis_resources
    const isCrisis = (kind === 'crisis');

    // 默认期望响应：crisis=5（最高）/ emotion=15 / concept=30 / cross_chapter=45
    //              streak=60 / out_of_scope=120 / planning=120 / manual=120
    const defaultETA = {
        crisis: 5,
        emotion: 15,
        concept: 30,
        cross_chapter: 45,
        streak_3_wrong: 60,
        out_of_scope: 120,
        planning: 120,
        manual: 120,
    }[kind] || 60;

    // crisis 强制 5 分钟，不允许调高
    let eta;
    if (isCrisis) {
        eta = 5;
    } else if (typeof expected_response_minutes === 'number' && expected_response_minutes > 0) {
        eta = Math.min(expected_response_minutes, 1440);
    } else {
        eta = defaultETA;
    }

    // 拼弹药包：调 student-dossier 端点把完整档案塞进 context.dossier（让学长 30 秒入戏）
    // P1-2 升级：从「只塞 weak_kps」升级为「塞完整学情档案」
    let enrichedContext = { ...safeContext };
    try {
        const origin = new URL(req.url).origin;
        const dossierResp = await fetch(`${origin}/api/student-dossier?student_id=${student_id}`, {
            // 内部调用，不需要 auth
            headers: { 'Accept': 'application/json' },
        });
        if (dossierResp.ok) {
            const dossier = await dossierResp.json();
            if (dossier.ok) {
                enrichedContext.dossier = {
                    mentor_brief: dossier.mentor_brief,
                    profile: dossier.profile,
                    stats: dossier.stats,
                    weak_kps: dossier.weak_kps,
                    mistake_top: dossier.mistake_top,
                    recent_dialogues: dossier.recent_dialogues?.slice(0, 2),  // 只塞 2 条避免 jsonb 过大
                };
            }
        }
    } catch (e) {
        // 弹药包丰富失败不阻塞 escalation 创建（fallback 到 safeContext 即可）
    }
    // Fallback：如果 dossier 拉失败，至少塞 weak_kps（旧逻辑保底）
    if (!enrichedContext.dossier) {
        try {
            const r = await pgFetch(`/student_states?student_id=eq.${student_id}&select=mastery_score,knowledge_points!inner(code,name)&order=mastery_score.asc&limit=3`);
            if (r.ok) {
                const states = await r.json();
                enrichedContext.weak_kps = states.map(s => ({
                    code: s.knowledge_points?.code,
                    name: s.knowledge_points?.name,
                    mastery: s.mastery_score,
                }));
            }
        } catch (e) {}
    }

    // ---- 把 detected_trigger 写入 context（学长侧前端可读，做样式区分）----
    enrichedContext.detected_trigger = {
        trigger: detected.trigger,
        trigger_cn: TRIGGER_CN[detected.trigger] || detected.trigger,
        confidence: detected.confidence,
        reason: detected.reason,
        auto_detected: !kindFromBody,
    };

    // ---- T6 crisis 注入危机资源 ----
    if (isCrisis) {
        enrichedContext.crisis_resources = CRISIS_RESOURCES;
        enrichedContext.crisis_flag = true;
    }

    // ---- 自动生成结构化工单 ai_summary（按 §4 格式，≤500 字）----
    // 用户传了就用用户的，没传就自动拼
    const ai_summary = aiSummaryFromBody
        ? String(aiSummaryFromBody).slice(0, 500)
        : buildStructuredTicket({
            kind,
            detected,
            student_message: safeMsg,
            recent_history: recent_history || enrichedContext.recent_history || [],
            dossier: enrichedContext.dossier,
            eta,
            topic_code,
        });

    const insertBody = {
        student_id,
        kind,
        student_message: safeMsg,
        context: enrichedContext,
        ai_summary,
        topic_code: topic_code || null,
        dialogue_id: dialogue_id && UUID_RE.test(dialogue_id) ? dialogue_id : null,
        expected_response_minutes: eta,
    };

    let inserted;
    try {
        const r = await pgFetch('/escalations', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify(insertBody),
        });
        if (!r.ok) {
            const detail = await r.text().catch(() => '');
            return jsonErr(502, 'pg_insert_failed', `${r.status}: ${detail.slice(0, 200)}`);
        }
        const arr = await r.json();
        inserted = Array.isArray(arr) ? arr[0] : arr;
    } catch (e) {
        return jsonErr(502, 'pg_network', e.message);
    }

    return jsonResp({
        ok: true,
        escalation_id: inserted.id,
        priority: inserted.priority,
        kind: inserted.kind,
        trigger: detected.trigger,
        trigger_cn: TRIGGER_CN[detected.trigger] || detected.trigger,
        auto_detected: !kindFromBody,
        confidence: detected.confidence,
        expected_response_minutes: inserted.expected_response_minutes,
        message: kindMessage(kind, inserted.expected_response_minutes),
        crisis_resources: isCrisis ? CRISIS_RESOURCES : undefined,
        ai_summary,  // 让前端能直接展示工单（mentor.html 抓得到）
        engine_version: 'escalate-v1.1',
    });
}

function kindMessage(kind, eta) {
    const map = {
        // T6 危机：直接给电话，不绕弯
        crisis: `先停。你说的这件事比作业重要太多。我让平台老师 5 分钟内联系你和爸妈，同时给你这个能立刻打的电话：${CRISIS_RESOURCES[0]}。你不是一个人。今天的题不用做了。`,
        // T1/T2 概念：分诊语言（不是兜底）
        concept: `这个问题让学长来讲会更透 · 约 ${eta} 分钟内回你。等的时候可以做下一道题`,
        // T5 情绪：先停，不强推下一题
        emotion: `老师看见你了 · 这种感觉学姐比我懂得讲，约 ${eta} 分钟内联系你 · 你先放一下`,
        streak_3_wrong: `这一类题咱多卡了几次 · 让学长录个 3 分钟讲解，约 ${eta} 分钟内发你`,
        // T3 跨章节
        cross_chapter: `这题跨章节了 · 学长能给你一个全局视角 · 约 ${eta} 分钟内回你`,
        // T4 长程规划
        planning: `规划级问题让学长姐姐回 · 约 ${eta} 分钟（他们要先看你的档案）`,
        // T7 能力边界
        out_of_scope: `这道题有点偏门 · 转学长更稳，他做过几十道 · 约 ${eta} 分钟内回你`,
        manual: `已发出 · 学长学姐约 ${eta} 分钟内联系你 · 等的时候做点别的`,
    };
    return map[kind] || `已发出 · 约 ${eta} 分钟内有人回你`;
}

// ---------------------------------------------------------------------------
// buildStructuredTicket · 自动按 §4 格式生成转交工单（≤500 字）
// ---------------------------------------------------------------------------
// 给学长 30 秒入戏：学生卡点 / AI 已尝试 / AI 判断 / 学生当下状态 / 学生历史 / 期望回复时间
function buildStructuredTicket({ kind, detected, student_message, recent_history, dossier, eta, topic_code }) {
    const profile = dossier?.profile || {};
    const stats = dossier?.stats || {};
    const weakKps = dossier?.weak_kps || [];

    // 学生标签：「小米（初一·北京·人教版）」
    const studentTag = [
        profile.name || '同学',
        profile.grade || '',
        profile.region || '',
        profile.exam_type || profile.curriculum || '',
    ].filter(Boolean).join('·');

    // AI 已尝试：抽 history 里 assistant 最近 2 条
    const aiTries = (Array.isArray(recent_history) ? recent_history : [])
        .filter(h => h.role === 'assistant')
        .slice(-2)
        .map((h, i) => `方式${i + 1}：${(h.content || '').slice(0, 60).replace(/\s+/g, ' ')}`)
        .join('\n');

    // AI 判断（基于 detected）
    const judgeMap = {
        T1: '学生连续两种讲法都没顺，建议换底层视角切入（如等式=天平、函数=机器）',
        T2: '学生连续追问"为什么"，需要概念底层讲解，不是规则套用',
        T3: '题目跨 2+ 章节，需要全局整合视角，AI 给方法但讲不出洞察',
        T4: '长程规划级，需要看完整档案后给个性化排期，AI 只能给原则',
        T5: '连续 3 轮负面信号，建议先停学习，让真人共情而非讲题',
        T6: '危机信号（自伤/严重负面）· 已上报家长 + 平台人工 + 心理援助 · 立即介入',
        T7: '题型超出 K12 主线（竞赛/偏门/地方考纲），转更资深学长更稳',
        manual: '学生显式呼叫 / 兜底类型',
    };
    const judgement = judgeMap[detected.trigger] || '';

    // 学生当下状态（学习时长/疲态从 stats 算）
    const minutesToday = stats.minutes_today ?? '?';
    const fatigue = stats.fatigue_level ?? '?';
    const escalateCount = stats.escalations_this_week ?? 1;

    // 最弱 KP（前 2 个）
    const weakStr = weakKps.slice(0, 2)
        .map(k => `${k.name || k.code}（${Math.round((k.mastery || 0) * 100)}%）`)
        .join(' / ') || '暂无数据';

    const lines = [
        '【转交工单】',
        `学生：${studentTag}`,
        `触发器：${TRIGGER_CN[detected.trigger] || detected.trigger}` + (detected.confidence < 1 ? `（置信度 ${Math.round(detected.confidence * 100)}%）` : ''),
        profile.tier ? `当前服务：Tier ${profile.tier}` : '',
        topic_code ? `关联 KP：${topic_code}` : '',
        '',
        '# 学生卡点',
        student_message.slice(0, 200),
        '',
    ];

    if (aiTries) {
        lines.push('# AI 已尝试', aiTries, '');
    }

    if (judgement) {
        lines.push('# AI 判断', judgement, '');
    }

    lines.push(
        '# 学生当下状态',
        `今天已学习 ${minutesToday} 分钟，疲态 ${fatigue}/3`,
        '',
        '# 学生历史',
        `最弱 KP：${weakStr}`,
        `本周转交次数：第 ${escalateCount} 次`,
        '',
        '# 期望回复时间',
        `${eta} 分钟内` + (kind === 'crisis' ? '（CRISIS · 必须人工立即介入）' : ''),
    );

    return lines.filter(l => l !== null && l !== undefined).join('\n').slice(0, 500);
}

async function handleList(req) {
    const url = new URL(req.url);
    const studentId = (url.searchParams.get('student_id') || '').trim().toLowerCase();
    const status = url.searchParams.get('status'); // pending|claimed|resolved|cancelled
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    if (!UUID_RE.test(studentId)) {
        return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');
    }

    let pgUrl = `/escalations?student_id=eq.${studentId}&select=*&order=created_at.desc&limit=${limit}`;
    if (status && ['pending', 'claimed', 'resolved', 'cancelled'].includes(status)) {
        pgUrl += `&status=eq.${status}`;
    }

    let rows;
    try {
        const r = await pgFetch(pgUrl);
        if (!r.ok) return jsonErr(502, 'pg_fetch_failed', `${r.status}`);
        rows = await r.json();
    } catch (e) {
        return jsonErr(502, 'pg_network', e.message);
    }

    const escalations = (rows || []).map(row => ({
        id: row.id,
        kind: row.kind,
        status: row.status,
        priority: row.priority,
        student_message: row.student_message,
        topic_code: row.topic_code,
        created_at: row.created_at,
        created_at_rel: fmtRelMin(row.created_at),
        expected_response_minutes: row.expected_response_minutes,
        claimed_at: row.claimed_at,
        resolved_at: row.resolved_at,
        resolution_kind: row.resolution_kind,
        resolution_content: row.resolution_content ? String(row.resolution_content).slice(0, 300) : null,
        resolution_minutes: row.resolution_minutes,
    }));

    const summary = {
        total: escalations.length,
        pending: escalations.filter(e => e.status === 'pending').length,
        claimed: escalations.filter(e => e.status === 'claimed').length,
        resolved: escalations.filter(e => e.status === 'resolved').length,
    };

    return jsonResp({
        ok: true,
        student_id: studentId,
        escalations,
        summary,
        engine_version: 'escalate-v1.0',
    });
}
