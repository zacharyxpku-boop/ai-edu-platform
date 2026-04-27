// 原点智学 · 对话向量化端点（批量 embedding cron）
// POST /api/embed-dialogue?limit=200
// Header: X-Admin-Token: <ADMIN_TOKEN>
//
// 拉 dialogues 表里 embedding IS NULL AND role='student' 的对话，
// 调阿里 dashscope text-embedding-v3 算 1024 维向量，写回 embedding 列。
//
// GitHub Actions cron 触发（同 extract-dialogue-signals 节奏，03:30）。

export const config = { runtime: 'edge', maxDuration: 60 };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_URL : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const QWEN_KEY = (typeof process !== 'undefined' && process.env) ? process.env.QWEN_KEY : '';
const ADMIN_TOKEN = (typeof process !== 'undefined' && process.env) ? process.env.ADMIN_TOKEN : '';
const ENGINE_VERSION = 'embed-v1.0-dashscope-v3';

const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings';

function jsonErr(s, c, m) {
    return new Response(JSON.stringify({ ok: false, error: c, message: m }), {
        status: s, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
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

async function embed(texts) {
    // dashscope text-embedding-v3，最多 25 条/批
    const r = await fetch(DASHSCOPE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + QWEN_KEY },
        body: JSON.stringify({
            model: 'text-embedding-v3',
            input: texts,
            dimensions: 1024,
            encoding_format: 'float',
        }),
    });
    if (!r.ok) throw new Error(`dashscope ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = await r.json();
    return data.data.map(d => d.embedding);
}

// pgvector 接受 '[0.1,0.2,...]' 字符串字面量
function vecToPgString(vec) {
    return '[' + vec.map(x => x.toFixed(6)).join(',') + ']';
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (req.method !== 'POST') return jsonErr(405, 'method_not_allowed', '只接受 POST');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !QWEN_KEY) {
        return jsonErr(503, 'not_configured', 'SUPABASE / QWEN env 未配齐');
    }
    if (req.headers.get('X-Admin-Token') !== ADMIN_TOKEN) {
        return jsonErr(401, 'unauthorized', 'admin token 错误');
    }

    const url = new URL(req.url);
    const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10));

    // 拉 student 角色 + 内容长度合适 + embedding 为空的
    const r = await pgFetch(
        `/dialogues?select=id,content&role=eq.student&embedding=is.null&content=not.is.null&order=created_at.asc&limit=${limit}`
    );
    if (!r.ok) return jsonErr(502, 'db_read_failed', await r.text());
    const rows = (await r.json()).filter(d => d.content && d.content.length >= 4 && d.content.length <= 2000);

    if (!rows.length) {
        return new Response(JSON.stringify({ ok: true, processed: 0, message: 'no pending dialogues', engine_version: ENGINE_VERSION }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });
    }

    let succ = 0, failed = 0;
    // 分批 25 条/批（dashscope 上限）
    const BATCH = 25;
    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        let vecs;
        try {
            vecs = await embed(batch.map(b => b.content));
        } catch (e) {
            failed += batch.length;
            continue;
        }
        // 一条一条 PATCH（pgvector PATCH 数组要单独）
        for (let j = 0; j < batch.length; j++) {
            const ok = await pgFetch(`/dialogues?id=eq.${batch[j].id}`, {
                method: 'PATCH',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify({ embedding: vecToPgString(vecs[j]) }),
            });
            if (ok.ok) succ++; else failed++;
        }
    }

    return new Response(JSON.stringify({
        ok: true, processed: rows.length, succeeded: succ, failed,
        engine_version: ENGINE_VERSION,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
