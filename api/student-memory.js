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
const ENGINE_VERSION = 'student-memory-v1.0';

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

function buildMemoryPrompt(memories, profile) {
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

    // 3. 拉信号指纹
    let profile = null;
    if (include_profile) {
        const pR = await pgRpc('student_signal_profile', { p_student_id: student_id });
        if (pR.ok) {
            const arr = await pR.json();
            profile = arr[0] || null;
        }
    }

    const system_prompt = buildMemoryPrompt(memories, profile);

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
