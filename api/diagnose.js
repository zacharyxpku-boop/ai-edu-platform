// 原点智学 · 错题归因引擎
// POST { problem, correct_answer, student_response, student_steps?, subject? }
// → { has_error, l1_tag, l2_tag, l3_tag[], evidence, root_cause, suggested_drill, confidence, engine_version }
//
// 设计要点（融合 Agent 6 实测教训）：
//   1. has_error 门控前置：答案与标准一致 → 直接 has_error=false 不调 LLM 不归因
//      （Agent 6 数据：默认归因导致干扰题 100% 假阳性，必须门控）
//   2. 64 类标签由 mistake-taxonomy.json 决定，封闭集合，禁止 LLM 自创
//   3. 上下文压缩：只把 (l3_id, l3_name, example) 三元组拼进 prompt，省 token
//   4. JSON 强解析：LLM 偶尔多余话或代码块包裹，用 extractJSON 兜底
//
// 调用：fetch('/api/diagnose', { method:'POST', body: JSON.stringify({...}) })

export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'diagnose-v1.0-gated-64tags';
const IP_LIMIT_PER_DAY = 30;
const ipBucket = new Map();

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const QWEN_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

let _taxCache = { at: 0, data: null, prompt: null };

async function getTaxonomy(origin) {
    const now = Date.now();
    if (_taxCache.data && (now - _taxCache.at) < 5 * 60 * 1000) return _taxCache;
    try {
        const r = await fetch(origin + '/src/curriculum/mistake-taxonomy.json', { cache: 'no-store' });
        if (!r.ok) return { data: null, prompt: null };
        const data = await r.json();
        const prompt = buildSystemPrompt(data);
        _taxCache = { at: now, data, prompt };
        return _taxCache;
    } catch (e) {
        return { data: null, prompt: null };
    }
}

// 把 64 类压缩成紧凑表格塞进 system prompt
function buildSystemPrompt(tax) {
    const lines = [];
    lines.push('你是 K12 错题归因专家。基于下面的 64 类标签封闭集合，给出严格 JSON 输出。');
    lines.push('');
    lines.push('=== 标签集合（l1.l2.l3）===');
    (tax.categories || []).forEach(l1 => {
        lines.push(`\n[${l1.l1_id}] ${l1.l1_name}`);
        (l1.subcategories || []).forEach(l2 => {
            lines.push(`  [${l2.l2_id}] ${l2.l2_name}`);
            (l2.tags || []).forEach(l3 => {
                const ex = (l3.example || '').slice(0, 50);
                lines.push(`    - ${l3.l3_id} | ${l3.l3_name} | 例：${ex}`);
            });
        });
    });
    lines.push('');
    lines.push('=== 输出契约（严格 JSON，无任何额外文字）===');
    lines.push('{');
    lines.push('  "l1_tag": "knowledge | ability | habit （三选一）",');
    lines.push('  "l2_tag": "对应 l2_id",');
    lines.push('  "l3_tag": ["对应 l3_id 数组，1-3 个"],');
    lines.push('  "evidence": "从学生答题里摘录原文≤40字",');
    lines.push('  "root_cause": "一句话说为什么错（30字内）",');
    lines.push('  "suggested_drill": "具体可执行 3-10 道题",');
    lines.push('  "confidence": "high | medium | low"');
    lines.push('}');
    lines.push('');
    lines.push('硬规则：');
    lines.push('1. l3_tag 必须从上述集合选，禁止自创新标签');
    lines.push('2. 无法分类时 l3_tag=["unknown.need_human_review"]');
    lines.push('3. 一题可多 l3 标签（如「符号错+单位漏」），l1 只选最主要的一个');
    lines.push('4. evidence 必须是原文摘录');
    lines.push('5. 输出必须是合法 JSON，禁止任何说明文字或代码块包裹');
    return lines.join('\n');
}

// 答案归一化对比（数学 / 字符串两种宽容模式）
function normalizeAnswer(s) {
    return String(s || '')
        .replace(/\s+/g, '')
        .replace(/[。.，,；;!！]$/, '')
        .replace(/^[xyXY]\s*=\s*/, '')
        .replace(/[（(][一-龥\w]*[)）]$/, '')
        .toLowerCase();
}

function answerMatches(submitted, correct) {
    const a = normalizeAnswer(submitted);
    const b = normalizeAnswer(correct);
    if (!a || !b) return false;
    if (a === b) return true;
    // 数值容差
    const an = parseFloat(a);
    const bn = parseFloat(b);
    if (!isNaN(an) && !isNaN(bn)) {
        return Math.abs(an - bn) < 1e-6;
    }
    return false;
}

function extractJSON(text) {
    if (!text) return null;
    // 去 markdown 包裹
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    // 直接试
    try { return JSON.parse(text); } catch (e) {}
    // 抠第一个 { ... } 块
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
        try { return JSON.parse(m[0]); } catch (e) {}
    }
    return null;
}

function todayKey() { return new Date().toISOString().slice(0, 10); }
function ratelimit(ip) {
    const k = ip + '|' + todayKey();
    const n = (ipBucket.get(k) || 0) + 1;
    ipBucket.set(k, n);
    if (ipBucket.size > 5000) {
        const today = todayKey();
        for (const key of ipBucket.keys()) {
            if (!key.endsWith('|' + today)) ipBucket.delete(key);
        }
    }
    return n <= IP_LIMIT_PER_DAY;
}

function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ error: code, message: msg }), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

async function callLLM(messages) {
    const dsKey = (typeof process !== 'undefined' && process.env) ? (process.env.DEEPSEEK_KEY || process.env.DEEPSEEK_API_KEY) : '';
    const qwKey = (typeof process !== 'undefined' && process.env) ? (process.env.QWEN_KEY || process.env.DASHSCOPE_API_KEY) : '';

    // 优先 DeepSeek（中文数理强，准确率基线 72.3% from Agent 6）
    if (dsKey) {
        try {
            const r = await fetch(DEEPSEEK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + dsKey },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages,
                    temperature: 0.2,
                    max_tokens: 600,
                    response_format: { type: 'json_object' }
                })
            });
            if (r.ok) {
                const data = await r.json();
                return { provider: 'deepseek', text: data.choices?.[0]?.message?.content || '' };
            }
        } catch (e) {}
    }
    // Qwen 兜底
    if (qwKey) {
        try {
            const r = await fetch(QWEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + qwKey },
                body: JSON.stringify({
                    model: 'qwen-plus',
                    messages,
                    temperature: 0.2,
                    max_tokens: 600
                })
            });
            if (r.ok) {
                const data = await r.json();
                return { provider: 'qwen', text: data.choices?.[0]?.message?.content || '' };
            }
        } catch (e) {}
    }
    return { provider: null, text: '' };
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'POST, OPTIONS',
                'access-control-allow-headers': 'content-type'
            }
        });
    }
    if (req.method !== 'POST') return jsonErr(405, 'method_not_allowed', '只接受 POST');

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip') || 'unknown';
    if (!ratelimit(ip)) {
        return jsonErr(429, 'rate_limited', '今日免费归因额度已用完');
    }

    let body;
    try { body = await req.json(); }
    catch (e) { return jsonErr(400, 'bad_json', '请求体不是合法 JSON'); }

    const { problem: rawProblem, correct_answer: rawAnswer, student_response: rawResp, student_steps: rawSteps, subject } = body || {};
    if (!rawProblem || rawAnswer == null || rawResp == null) {
        return jsonErr(400, 'missing_fields', 'problem / correct_answer / student_response 三者必填');
    }
    // 输入字段硬截断 · 防意外大 payload 烧 token + 防初级 prompt injection 灌长指令
    const problem = String(rawProblem).slice(0, 2000);
    const correct_answer = String(rawAnswer).slice(0, 500);
    const student_response = String(rawResp).slice(0, 2000);
    const student_steps = rawSteps ? String(rawSteps).slice(0, 2000) : null;

    // === 关键门控 ===
    // 答案对了直接放行，不调 LLM 不归因（避免 Agent 6 实测的「干扰题 100% 假阳性」灾难）
    if (answerMatches(student_response, correct_answer)) {
        return new Response(JSON.stringify({
            has_error: false,
            verdict: 'correct',
            engine_version: ENGINE_VERSION,
            note: '答案与标准一致，本题通过，无需归因'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        });
    }

    // === 答错才进 LLM 64 类归因 ===
    const origin = new URL(req.url).origin;
    const { prompt: systemPrompt } = await getTaxonomy(origin);
    if (!systemPrompt) {
        return jsonErr(503, 'taxonomy_unavailable', 'mistake-taxonomy.json 加载失败');
    }

    const userMsg = [
        `【学科】${subject || '未指定'}`,
        `【题目】${problem}`,
        `【标准答案】${correct_answer}`,
        `【学生作答】${student_response}`,
        student_steps ? `【学生步骤】${student_steps}` : ''
    ].filter(Boolean).join('\n');

    const llmResult = await callLLM([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg }
    ]);

    if (!llmResult.text) {
        return jsonErr(502, 'llm_failed', '上游模型未返回内容');
    }

    const parsed = extractJSON(llmResult.text);
    if (!parsed) {
        return new Response(JSON.stringify({
            has_error: true,
            verdict: 'llm_unparseable',
            l1_tag: 'unknown',
            l3_tag: ['unknown.need_human_review'],
            raw: llmResult.text.slice(0, 500),
            engine_version: ENGINE_VERSION,
            provider: llmResult.provider
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    }

    return new Response(JSON.stringify({
        has_error: true,
        verdict: 'analyzed',
        l1_tag: parsed.l1_tag || 'unknown',
        l2_tag: parsed.l2_tag || null,
        l3_tag: Array.isArray(parsed.l3_tag) ? parsed.l3_tag : (parsed.l3_tag ? [parsed.l3_tag] : []),
        evidence: parsed.evidence || null,
        root_cause: parsed.root_cause || null,
        suggested_drill: parsed.suggested_drill || null,
        confidence: parsed.confidence || 'medium',
        provider: llmResult.provider,
        engine_version: ENGINE_VERSION
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}
