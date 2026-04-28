// 原点智学 · AI 诊断报告生成器（GPT 后端代理）
// POST { name, grade, subject, answers: [{q, a}, ...] }
// → { dimensions: [{name, score, gap, hint}], summary, recommendation, match_product, generated_at }
//
// 调用 OpenAI gpt-4o-mini 生成结构化 13 维度知识漏洞报告
// API key 走 OPENAI_API_KEY 环境变量, 永不在前端暴露
// IP 限频: 每 IP 每天 10 次

export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'diagnose-report-v1.0-openai';
const IP_LIMIT_PER_DAY = 10;
const ipBucket = new Map();

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

function getIp(req) {
    const headers = req.headers;
    return headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

function checkRateLimit(ip) {
    const today = new Date().toISOString().slice(0, 10);
    const key = `${ip}::${today}`;
    const count = ipBucket.get(key) || 0;
    if (count >= IP_LIMIT_PER_DAY) return false;
    ipBucket.set(key, count + 1);
    if (ipBucket.size > 5000) {
        const cutoff = Date.now() - 86400000;
        for (const [k] of ipBucket) {
            if (parseInt(k.split('::')[1].replace(/-/g, ''), 10) < cutoff) ipBucket.delete(k);
        }
    }
    return true;
}

function extractJSON(text) {
    if (!text) return null;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch (e) { return null; }
}

const SYSTEM_PROMPT = `你是原点智学的 AI 学习诊断师。基于学生的年级、学科、答题数据，输出一份结构化 JSON 报告，覆盖 13 个维度的知识漏洞分析。

要求:
1. 严格输出 JSON, 不要 markdown 代码块包裹, 不要任何前后说明文字
2. 输出 schema:
{
  "summary": "120 字内一段话总结当前问题",
  "dimensions": [
    {"name":"维度名","score":0-100,"gap":"具体漏洞描述（30字内）","hint":"提升建议（30字内）"}
  ],
  "recommendation": "150 字内, 给家长的具体下一步行动建议",
  "match_product": "online" | "camp" | "qingbei",
  "match_reason": "50字内, 推荐这档的理由"
}
3. dimensions 必须包含 13 项, 涵盖知识广度/深度/计算/概念/审题/书写/速度/复盘/记忆/策略/迁移/思维/输出
4. score 0-100, 60 分以下高亮为弱项. 至少标 4-6 个弱项, 不要全部高分粉饰
5. match_product 选一档 (online ¥2499 / camp ¥4980 / qingbei ¥6980), 根据弱项严重程度匹配
6. 文案口吻: 像清北学长帮家长看分数, 不卖惨不夸张, 客观但有方向感
7. 用「孩子」称呼学生, 不要直呼姓名 (姓名仅用作 personalize summary 开头一句)`;

function buildUserPrompt(payload) {
    const { name, grade, subject, answers } = payload;
    const answersText = (answers || []).map((a, i) =>
        `Q${i + 1}: ${a.q}\n学生答: ${a.a || '（未作答）'}`
    ).join('\n\n');
    return `孩子姓名: ${name || '某同学'}
年级: ${grade || '未知'}
重点学科: ${subject || '综合'}

答题记录:
${answersText || '（无）'}

请按 schema 输出 JSON 诊断报告.`;
}

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const ip = getIp(req);
    if (!checkRateLimit(ip)) {
        return new Response(JSON.stringify({ error: '今日诊断次数已达上限, 明天再试' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    let payload = null;
    try { payload = await req.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'invalid json' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'OPENAI_API_KEY 未配置' }), {
            status: 503, headers: { 'Content-Type': 'application/json' }
        });
    }

    const userPrompt = buildUserPrompt(payload);

    let upstream;
    try {
        upstream = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 1800,
                response_format: { type: 'json_object' }
            })
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'upstream fetch failed', detail: String(e) }), {
            status: 502, headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!upstream.ok) {
        const text = await upstream.text();
        return new Response(JSON.stringify({ error: 'openai error', status: upstream.status, detail: text.slice(0, 500) }), {
            status: 502, headers: { 'Content-Type': 'application/json' }
        });
    }

    let data;
    try { data = await upstream.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'upstream json parse failed' }), {
            status: 502, headers: { 'Content-Type': 'application/json' }
        });
    }

    const content = data?.choices?.[0]?.message?.content || '';
    const report = extractJSON(content);

    if (!report || !Array.isArray(report.dimensions)) {
        return new Response(JSON.stringify({ error: 'AI 输出无法解析', raw: content.slice(0, 500) }), {
            status: 502, headers: { 'Content-Type': 'application/json' }
        });
    }

    report.engine_version = ENGINE_VERSION;
    report.generated_at = new Date().toISOString();

    return new Response(JSON.stringify(report), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        }
    });
}
