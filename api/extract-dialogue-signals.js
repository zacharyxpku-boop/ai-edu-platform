// 原点智学 · 对话隐性信号抽取
// POST /api/extract-dialogue-signals?limit=100
// Header: X-Admin-Token: <ADMIN_TOKEN>
//
// 从 dialogues 表里拉 meta->signals 还是 NULL 的对话，每条调 LLM 抽 4 字段：
//   1. stuck_point        学生当前卡在哪个具体步骤/概念
//   2. misconception_l3   对应 mistake-taxonomy 64 类的 l3_id（命中则填，否则 null）
//   3. analogy_effective  类比是否奏效（true/false/null）—— 看下一句学生反应
//   4. emotion_state      焦虑/自信/走神/投入/沮丧/平和（六分类）
//
// 写回 dialogues.meta.signals + meta.signals_extracted_at
//
// 设计哲学（壁垒构建）：
//   每条对话 = 1 条标注数据。1000 学员 × 4 周 × 平均 50 句话 = 20 万条标注。
//   一年累积后，跨用户聚合：「在『一元一次方程移项』这个卡点上，
//   类比『天平左右平衡』奏效率 73%，类比『搬家具』奏效率 41%」——
//   这种 insight 没人有，是中文 K12 AI 私教的独家数据资产。
//
// 调用：
//   - GitHub Actions 每天 04:00 调用一次（处理前一天对话）
//   - 也可手动触发，processing 100 条/次，避免超时

export const config = { runtime: 'edge', maxDuration: 60 };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_URL : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const DEEPSEEK_KEY = (typeof process !== 'undefined' && process.env) ? process.env.DEEPSEEK_KEY : '';
const ADMIN_TOKEN = (typeof process !== 'undefined' && process.env) ? process.env.ADMIN_TOKEN : '';
const ENGINE_VERSION = 'extract-signals-v1.0';

const EMOTION_STATES = ['焦虑', '自信', '走神', '投入', '沮丧', '平和'];

const SYSTEM_PROMPT = `你是 K12 学生认知行为分析专家。任务：从一条 AI 私教对话中抽取学生的 4 个隐性认知信号。

输入：一段对话（含一句学生说的话 + 上下文 1-2 句 tutor 之前的话）
输出：严格 JSON，无任何额外文字。

字段定义：

1. stuck_point（字符串，≤30 字）
   - 学生当前**最具体**的卡点。例：「分式方程去分母漏乘整式项」「移项忘记变号」
   - 不要写宽泛的「不会方程」，要具体到操作/概念
   - 如果学生答对了 / 在闲聊 / 没明显卡点，填 null

2. misconception_l3（字符串）
   - 从下面 64 类 misconception ID 里选一个 l3_id（精确匹配前缀）
   - 主要类目：knowledge.* / ability.* / habit.*
   - 没明显归因填 null

3. analogy_effective（true / false / null）
   - 如果上文 tutor 用了类比/比喻，看学生这句话的反应判断奏效
   - true: 学生说「哦原来是这样」「我懂了」「这样想就对了」类
   - false: 学生说「还是不懂」「这跟那个有什么关系」类
   - null: tutor 没用类比，或反应不明确

4. emotion_state（字符串）
   - 六选一：焦虑 / 自信 / 走神 / 投入 / 沮丧 / 平和
   - 焦虑：「这道题好难」「我做不出来」
   - 自信：「我会了」「这个简单」
   - 走神：答非所问 / 中途切换话题
   - 投入：主动提问 / 给出推理过程
   - 沮丧：「算了不学了」「太烦了」
   - 平和：默认状态

输出格式严格如下（无任何 markdown 包裹）：
{"stuck_point":"...","misconception_l3":"...","analogy_effective":true,"emotion_state":"..."}`;


function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ ok: false, error: code, message: msg }), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

function extractJSON(text) {
    if (!text) return null;
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(text); } catch (e) {}
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    return null;
}

async function callDeepSeek(messages) {
    try {
        const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages,
                temperature: 0.1,
                max_tokens: 200,
                response_format: { type: 'json_object' },
            }),
        });
        if (!r.ok) return null;
        const data = await r.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e) { return null; }
}

async function pgFetch(path, opts = {}) {
    return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        ...opts,
        headers: {
            ...(opts.headers || {}),
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
        },
    });
}

async function fetchPending(limit) {
    // 0004 后 dialogues.meta default '{}'，所以查 meta->>'signals_extracted_at' IS NULL
    // PostgREST 语法：meta->>signals_extracted_at=is.null
    const r = await pgFetch(`/dialogues?select=id,student_id,role,content,kind,question_id,meta,created_at&meta->>signals_extracted_at=is.null&order=created_at.asc&limit=${limit}`);
    if (!r.ok) return [];
    return await r.json();
}

async function fetchContext(student_id, before_at) {
    // 取该学生 created_at < before_at 的最近 2 条对话作为 tutor/student 上下文
    const r = await pgFetch(`/dialogues?select=role,content&student_id=eq.${student_id}&created_at=lt.${before_at}&order=created_at.desc&limit=2`);
    if (!r.ok) return [];
    const list = await r.json();
    return list.reverse();
}

async function updateSignals(dialogueId, signals, existingMeta) {
    const newMeta = {
        ...(existingMeta || {}),
        signals,
        signals_extracted_at: new Date().toISOString(),
    };
    const r = await pgFetch(`/dialogues?id=eq.${dialogueId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ meta: newMeta }),
    });
    return r.ok;
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    if (req.method !== 'POST') return jsonErr(405, 'method_not_allowed', '只接受 POST');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !DEEPSEEK_KEY) {
        return jsonErr(503, 'not_configured', 'SUPABASE / DEEPSEEK env 未配齐');
    }
    if (!ADMIN_TOKEN) return jsonErr(503, 'no_admin_token', 'ADMIN_TOKEN 未设');

    const token = req.headers.get('X-Admin-Token') || req.headers.get('x-admin-token');
    if (token !== ADMIN_TOKEN) return jsonErr(401, 'unauthorized', 'admin token 错误');

    const url = new URL(req.url);
    const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10));

    const pending = await fetchPending(limit);
    if (!pending.length) {
        return new Response(JSON.stringify({
            ok: true, processed: 0, message: 'no pending dialogues',
            engine_version: ENGINE_VERSION,
        }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }

    let succ = 0, failed = 0, skipped = 0;
    const samples = [];

    for (const row of pending) {
        // 系统消息 / 太短 跳过
        if (row.role === 'system' || !row.content || row.content.length < 4) {
            await updateSignals(row.id, null, row.meta);
            skipped++;
            continue;
        }

        // 取上下文（tutor 上一句 + 学生上一句）
        const ctx = await fetchContext(row.student_id, row.created_at);
        const ctxStr = ctx.map(c => `[${c.role}] ${c.content}`).join('\n');

        const userMsg = `${ctxStr ? `【上下文】\n${ctxStr}\n\n` : ''}【本句】[${row.role}] ${row.content}\n\n请按 schema 输出 JSON。`;

        const llmText = await callDeepSeek([
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMsg },
        ]);
        if (!llmText) { failed++; continue; }

        const parsed = extractJSON(llmText);
        if (!parsed) { failed++; continue; }

        // 校验 emotion_state 在白名单
        const signals = {
            stuck_point: parsed.stuck_point && parsed.stuck_point !== 'null' ? String(parsed.stuck_point).slice(0, 60) : null,
            misconception_l3: parsed.misconception_l3 && parsed.misconception_l3 !== 'null' ? String(parsed.misconception_l3).slice(0, 80) : null,
            analogy_effective: typeof parsed.analogy_effective === 'boolean' ? parsed.analogy_effective : null,
            emotion_state: EMOTION_STATES.includes(parsed.emotion_state) ? parsed.emotion_state : '平和',
        };

        const ok = await updateSignals(row.id, signals, row.meta);
        if (ok) {
            succ++;
            if (samples.length < 3) samples.push({ id: row.id, signals });
        } else {
            failed++;
        }
    }

    return new Response(JSON.stringify({
        ok: true,
        processed: pending.length,
        succeeded: succ,
        failed,
        skipped,
        samples,
        engine_version: ENGINE_VERSION,
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}
