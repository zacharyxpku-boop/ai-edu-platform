// 原点智学 · 出师金句生成（晒图卡片专用）
// POST { student_id?, topic, minutes, attempts_count, correct_count, final_mastery, highlights[] }
// → { quote, sub_quote, share_for_mom }
//
// 设计哲学（反 Khanmigo 没产出）：
//   Khanmigo 学完只有 progress bar 和「Great job」。妈妈打开看不到任何具体的「孩子今天进步了什么」。
//   我们每次出师必生成 3 段：
//     · quote      → 学生视角，一句让他骄傲的总结（适合截屏发朋友圈）
//     · sub_quote  → 一行小字，今天他**自己**多走对的那一步（具体到行为）
//     · share_for_mom → 给妈妈看的版本：客观、不浮夸、有具体进步点
//
//   坚持「具体优于赞美」：禁止「你真棒」「太厉害了」「学习能手」这种空洞话
//   只准描写**他今天具体在哪一步从卡到通**——这是 Khanmigo 报告永远做不到的。

export const config = { runtime: 'edge' };

const DEEPSEEK_KEY = (typeof process !== 'undefined' && process.env)
    ? (process.env.DEEPSEEK_KEY || process.env.DEEPSEEK_API_KEY) : '';
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

function jerr(s, c, m) {
    return new Response(JSON.stringify({ ok: false, error: c, message: m }), {
        status: s, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

function buildPrompt(p) {
    const {
        topic = '这个知识点',
        minutes = 0,
        attempts_count = 0,
        correct_count = 0,
        final_mastery = 0,
        highlights = [],         // 数组：[{step:'去分母', from:'错', to:'对'}, ...]
        student_name = '',
    } = p;

    const masteryPct = Math.round(final_mastery * 100);
    const correctRate = attempts_count > 0 ? Math.round(correct_count * 100 / attempts_count) : 0;
    const hl = (highlights || []).slice(0, 3).map((h, i) => {
        if (typeof h === 'string') return `  ${i + 1}. ${h}`;
        if (h && typeof h === 'object') {
            const step = h.step || h.kp || h.point || '';
            const change = h.from && h.to ? `（${h.from} → ${h.to}）` : '';
            return `  ${i + 1}. ${step}${change}`;
        }
        return '';
    }).filter(Boolean).join('\n');

    const L = [];
    L.push('你是原点智学的私教老师。学生刚完成一道知识点的「出师」（掌握度 ≥ 90%）。');
    L.push('你的任务：写 3 段文字。');
    L.push('');
    L.push('═══ 学生本次表现 ═══');
    if (student_name) L.push(`【姓名】${student_name}`);
    L.push(`【知识点】${topic}`);
    L.push(`【用时】${minutes} 分钟`);
    L.push(`【答题】${correct_count}/${attempts_count}（正确率 ${correctRate}%）`);
    L.push(`【最终掌握度】${masteryPct}%`);
    if (hl) {
        L.push('【过程亮点】');
        L.push(hl);
    }
    L.push('');
    L.push('═══ 输出要求（严格 JSON）═══');
    L.push('返回纯 JSON，不要 markdown，不要 ```json 包裹：');
    L.push('{');
    L.push('  "quote": "一句让孩子自己骄傲的话（≤ 22 字，第一人称『我』）",');
    L.push('  "sub_quote": "一行小字，具体描写他今天哪一步自己想出来了（≤ 30 字）",');
    L.push('  "share_for_mom": "给妈妈看的客观描述（≤ 50 字，禁夸张词，含具体进步点）"');
    L.push('}');
    L.push('');
    L.push('═══ 风格铁律 ═══');
    L.push('· 禁词：太棒了/真厉害/学习能手/王者/大神/最强/优秀/卓越/惊艳/震撼');
    L.push('· 禁套话：加油/继续努力/前途无量/你很有天赋');
    L.push('· 禁 emoji 堆砌（最多 1 个，不放也行）');
    L.push('· 必须**具体到这一题/这一步**，不要泛泛「数学进步了」');
    L.push('· 给妈妈那段：用「他今天在 X 处自己想出来了」格式，可量化（用时/正确率）但不堆数字');
    L.push('· 第一人称 quote 用孩子说话的语气，不要文邹邹');
    L.push('');
    L.push('═══ 示例（仅参考语气，不要直接抄）═══');
    L.push('  quote: "去分母这步，我终于不漏乘了"');
    L.push('  sub_quote: "前两题还在错，第三题自己想到要乘整式项"');
    L.push('  share_for_mom: "今晚 12 分钟，他在去分母的漏乘上从错到对，不再问我了"');
    return L.join('\n');
}

// 简易 IP 限流（出师才触发，10 次/分钟够正常场景）
const IP_LIMIT_PER_MIN = 10;
const ipBucket = new Map();
function ratelimit(ip) {
    const minute = Math.floor(Date.now() / 60000);
    const k = ip + '|' + minute;
    const n = (ipBucket.get(k) || 0) + 1;
    ipBucket.set(k, n);
    if (ipBucket.size > 5000) {
        for (const key of ipBucket.keys()) {
            const m = parseInt(key.split('|')[1], 10);
            if (m < minute - 1) ipBucket.delete(key);
        }
    }
    return n <= IP_LIMIT_PER_MIN;
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
    if (req.method !== 'POST') return jerr(405, 'method_not_allowed', '只接 POST');
    if (!DEEPSEEK_KEY) return jerr(503, 'not_configured', 'DEEPSEEK key 未配');

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip') || 'unknown';
    if (!ratelimit(ip)) return jerr(429, 'rate_limited', '请求过于频繁（10 次/分钟上限）');

    let body;
    try { body = await req.json(); }
    catch (e) { return jerr(400, 'bad_json', '请求体不是合法 JSON'); }

    const { topic } = body || {};
    if (!topic) return jerr(400, 'missing_topic', 'topic 必填');

    const prompt = buildPrompt(body);

    let r;
    try {
        r = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + DEEPSEEK_KEY,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: '你是原点智学的私教老师。请按要求返回纯 JSON 对象。' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 220,
                response_format: { type: 'json_object' },
            }),
        });
    } catch (e) {
        return jerr(502, 'upstream_unreachable', 'DeepSeek 不可达：' + e.message);
    }
    if (!r.ok) return jerr(502, 'upstream_error', `DeepSeek ${r.status}`);

    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) {
        // 兜底：拿原文当 quote
        parsed = {
            quote: '今晚这一关，我自己拿下了',
            sub_quote: '从一道一道错到稳定做对',
            share_for_mom: `他今晚把「${body.topic}」从入门做到 ${Math.round((body.final_mastery || 0) * 100)}%，过程自己走完`,
            _fallback: true,
            _raw: raw.slice(0, 200),
        };
    }

    return new Response(JSON.stringify({
        ok: true,
        quote: parsed.quote || '',
        sub_quote: parsed.sub_quote || '',
        share_for_mom: parsed.share_for_mom || '',
        meta: {
            topic: body.topic,
            mastery: body.final_mastery,
            engine: 'deepseek-chat',
        },
        _fallback: parsed._fallback || false,
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}
