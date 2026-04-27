// 原点智学 · 学生跨会话记忆检索
// POST { student_id, query, top_k? }
// → { memories[], signal_profile, system_prompt }
//
// 用途：
//   1. tutor 接新一题前调用，把过去类似情境的卡点 / 误区拉出来
//   2. 包成 system_prompt 喂 LLM：「这个孩子之前在『分式去分母』卡过，类比『天平』奏效」
//   3. 真正的「AI 记得你」—— 是 Khanmigo 没做的留存武器

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const QWEN_KEY = (typeof process !== 'undefined' && process.env) ? (process.env.QWEN_KEY || process.env.DASHSCOPE_API_KEY) : '';
const ENGINE_VERSION = 'student-memory-v1.1';

const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings';

function jsonErr(s, c, m) {
    return new Response(JSON.stringify({ ok: false, error: c, message: m }), {
        status: s, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

async function pgRpc(name, params) {
    return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });
}

async function embedQuery(text) {
    const r = await fetch(DASHSCOPE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + QWEN_KEY },
        body: JSON.stringify({
            model: 'text-embedding-v3',
            input: [text.slice(0, 2000)],
            dimensions: 1024,
        }),
    });
    if (!r.ok) throw new Error(`embed failed: ${r.status}`);
    const data = await r.json();
    return data.data[0].embedding;
}

function vecToPgString(vec) {
    return '[' + vec.map(x => x.toFixed(6)).join(',') + ']';
}

// 拉最近 50 条 signals 已抽好的 dialogue，聚合 cognitive_style 众数 + interest 词频
async function rollupExtras(student_id) {
    try {
        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/dialogues?select=meta&student_id=eq.${student_id}&meta->>signals_extracted_at=not.is.null&order=created_at.desc&limit=50`,
            { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY } }
        );
        if (!r.ok) return null;
        const rows = await r.json();
        const styleCount = {};
        const interestCount = {};
        for (const row of rows) {
            const s = row?.meta?.signals;
            if (!s) continue;
            if (s.cognitive_style && s.cognitive_style !== 'unknown') {
                styleCount[s.cognitive_style] = (styleCount[s.cognitive_style] || 0) + 1;
            }
            if (Array.isArray(s.interest_keywords)) {
                for (const k of s.interest_keywords) {
                    if (typeof k === 'string' && k.length <= 8) {
                        interestCount[k] = (interestCount[k] || 0) + 1;
                    }
                }
            }
        }
        const styleMode = Object.entries(styleCount).sort((a, b) => b[1] - a[1])[0];
        const topInterests = Object.entries(interestCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([k, c]) => ({ keyword: k, count: c }));
        return {
            cognitive_style: styleMode ? styleMode[0] : 'unknown',
            cognitive_style_confidence: styleMode ? Math.min(1, styleMode[1] / 5) : 0,
            top_interests: topInterests,
            sample_size: rows.length,
        };
    } catch (e) { return null; }
}

const STYLE_HINTS = {
    visual: '他偏视觉 → 多画图 / 表格 / 数轴',
    verbal: '他偏语言 → 多用故事化叙述 / 举具体例子',
    kinesthetic: '他偏动手 → 让他自己推一遍，少灌输',
    abstract: '他偏抽象 → 直接讲公式逻辑/为什么，不用比喻',
};

function buildMemoryPrompt(memories, profile, extras) {
    const lines = [];
    lines.push('=== 这个学生的历史记忆指纹 ===');
    if (profile && profile.dominant_emotion) {
        lines.push(`· 主导情绪：${profile.dominant_emotion}`);
    }
    if (profile && profile.top_stuck_points && profile.top_stuck_points.length) {
        lines.push(`· 高频卡点：${profile.top_stuck_points.filter(Boolean).slice(0, 3).join(' / ')}`);
    }
    if (profile && profile.analogy_success_rate != null) {
        lines.push(`· 类比奏效率：${(profile.analogy_success_rate * 100).toFixed(0)}%（${profile.analogy_success_rate > 0.6 ? '类比对他有效，多用比喻' : '类比效果一般，直接讲'}）`);
    }
    if (extras && extras.cognitive_style && extras.cognitive_style !== 'unknown' && extras.cognitive_style_confidence >= 0.4) {
        lines.push(`· 认知风格：${extras.cognitive_style}（${STYLE_HINTS[extras.cognitive_style] || ''}）`);
    }
    if (extras && extras.top_interests && extras.top_interests.length) {
        const top = extras.top_interests.slice(0, 3).map(t => t.keyword).join(' / ');
        lines.push(`· 兴趣词典：${top}（恰当时机用作类比锚点，**不要硬塞**）`);
    }

    if (memories && memories.length) {
        lines.push('');
        lines.push('=== 过去类似情境的回忆（按相似度降序）===');
        memories.slice(0, 3).forEach((m, i) => {
            lines.push(`${i + 1}. [${new Date(m.created_at).toLocaleDateString('zh-CN')}] (相似度 ${(m.similarity * 100).toFixed(0)}%)`);
            lines.push(`   学生说：${m.content.slice(0, 100)}`);
            if (m.signals && m.signals.stuck_point) {
                lines.push(`   当时卡点：${m.signals.stuck_point}`);
            }
        });
    }
    lines.push('');
    lines.push('用这些信息让你的回应「记得这个孩子」——别让他重新解释自己卡在哪。');
    return lines.join('\n');
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (req.method !== 'POST') return jsonErr(405, 'method_not_allowed', '只接受 POST');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !QWEN_KEY) {
        return jsonErr(503, 'not_configured', 'env 未配齐');
    }

    let body;
    try { body = await req.json(); }
    catch (e) { return jsonErr(400, 'bad_json', '请求体不是合法 JSON'); }

    const { student_id, query, top_k = 5, include_profile = true } = body || {};
    if (!student_id || !query) return jsonErr(400, 'missing_fields', 'student_id + query 必填');

    // 1. embed query
    let qVec;
    try {
        qVec = await embedQuery(query);
    } catch (e) {
        return jsonErr(502, 'embed_failed', e.message);
    }

    // 2. 拉相似对话
    const memR = await pgRpc('student_memory_search', {
        p_student_id: student_id,
        p_query_embedding: vecToPgString(qVec),
        p_top_k: top_k,
        p_min_age_seconds: 1800,
    });
    const memories = memR.ok ? await memR.json() : [];

    // 3. 拉信号指纹 + 4. 拉认知风格 / 兴趣词典 rollup（并行）
    const [pR, extras] = await Promise.all([
        include_profile ? pgRpc('student_signal_profile', { p_student_id: student_id }) : Promise.resolve(null),
        include_profile ? rollupExtras(student_id) : Promise.resolve(null),
    ]);
    let profile = null;
    if (pR && pR.ok) {
        const arr = await pR.json();
        profile = arr[0] || null;
    }

    // extras 信号合并进 profile 顶层（方便下游 tutor-chat 访问）
    if (profile && extras) {
        profile.cognitive_style = extras.cognitive_style;
        profile.cognitive_style_confidence = extras.cognitive_style_confidence;
        profile.top_interests = extras.top_interests;
    } else if (!profile && extras) {
        profile = {
            cognitive_style: extras.cognitive_style,
            cognitive_style_confidence: extras.cognitive_style_confidence,
            top_interests: extras.top_interests,
        };
    }

    const system_prompt = buildMemoryPrompt(memories, profile, extras);

    return new Response(JSON.stringify({
        ok: true,
        student_id,
        query: query.slice(0, 200),
        memories,
        memory_count: memories.length,
        signal_profile: profile,
        system_prompt,
        engine_version: ENGINE_VERSION,
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}
