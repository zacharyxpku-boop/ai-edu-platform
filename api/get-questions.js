// 原点智学 · 题库拉题端点
// GET /api/get-questions?topic_code=math.7.ch3.kp3&limit=5&difficulty_max=0.7
// → { ok, items: [{ id, stem, options, answer, explanation, difficulty, type, kp_id }], count, via }
//
// 流程：
//   1. SELECT id FROM knowledge_points WHERE code = topic_code
//   2. SELECT * FROM questions WHERE knowledge_point_ids @> ARRAY[kp_uuid] AND is_active LIMIT n
//   3. 不够数 → fallback：找同 chapter（topic_code 前缀 'math.7.ch3'）下所有 KP id，再 union 拉
//
// 字段对齐 0001 questions 表：
//   content → stem, options(jsonb)→options, answer→answer, explanation→explanation
//   difficulty → difficulty(numeric 0-1), type(enum)→type
//
// 设计要点：
//   - PostgREST 不直接支持 ARRAY[uuid] @> 语法 → 用 cs (contains) operator
//     形如 knowledge_point_ids=cs.{uuid1,uuid2}
//   - 同 chapter fallback：code like 'math.7.ch3.%'，避免单 KP 没题打空
//   - Edge runtime + CORS（与项目其它端点一致）

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) : '';
const ENGINE_VERSION = 'get-questions-v1.0';

const CORS_HEADERS = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
};

function jsonOk(payload, cacheSec = 60) {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': `public, max-age=${cacheSec}`,
            ...CORS_HEADERS,
        },
    });
}

function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ ok: false, error: code, message: msg }), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
    });
}

// PostgREST 调用封装
async function pgQuery(path) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Accept': 'application/json',
        },
    });
    if (!r.ok) {
        const text = await r.text();
        throw new Error(`PostgREST ${r.status}: ${text.slice(0, 200)}`);
    }
    return r.json();
}

// 把 questions 行 → mastery-loop 期望结构
function normalize(row) {
    const stem = row.content || '';
    let options = row.options;
    // options 可能是 jsonb 字符串、对象或 null
    if (typeof options === 'string') {
        try { options = JSON.parse(options); } catch (e) { options = null; }
    }
    const hasOptions = options && typeof options === 'object' && Object.keys(options).length > 0;
    return {
        id: row.id,
        stem,
        options: hasOptions ? options : null,
        answer: row.answer,
        explanation: row.explanation || null,
        difficulty: row.difficulty != null ? Number(row.difficulty) : 0.5,
        type: row.type || (hasOptions ? 'mcq' : 'fill_blank'),
        kp_id: Array.isArray(row.knowledge_point_ids) ? row.knowledge_point_ids[0] : null,
    };
}

// 给定一组 kp uuid，按 cs (contains) 拉 questions
async function fetchQuestionsByKpIds(kpIds, limit, difficultyMax) {
    if (!kpIds.length) return [];
    // PostgREST or() 拼一组 cs 谓词，命中任一 kp 即可
    const orParts = kpIds.map(id => `knowledge_point_ids.cs.{${id}}`);
    let q = `questions?or=(${orParts.join(',')})&is_active=eq.true`
        + `&select=id,content,options,answer,explanation,difficulty,type,knowledge_point_ids`
        + `&limit=${limit}`;
    if (difficultyMax != null) q += `&difficulty=lte.${difficultyMax}`;
    return pgQuery(q);
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method !== 'GET') return jsonErr(405, 'method_not_allowed', '只接受 GET');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return jsonErr(503, 'not_configured', 'Supabase env 未配');
    }

    const url = new URL(req.url);
    const topicCode = (url.searchParams.get('topic_code') || '').trim();
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '5', 10)));
    const diffParam = url.searchParams.get('difficulty_max');
    const difficultyMax = diffParam != null ? Math.max(0, Math.min(1, Number(diffParam))) : null;

    if (!topicCode) return jsonErr(400, 'missing_topic_code', 'topic_code 必填');

    try {
        // 1. 拿 KP uuid
        const kpRows = await pgQuery(
            `knowledge_points?code=eq.${encodeURIComponent(topicCode)}&select=id,code,name&limit=1`
        );
        const kp = kpRows[0];
        if (!kp) {
            return jsonErr(404, 'kp_not_found', `topic_code=${topicCode} 在 knowledge_points 表无匹配`);
        }

        // 2. 精确 KP 拉题
        let rows = await fetchQuestionsByKpIds([kp.id], limit, difficultyMax);
        let via = 'exact_kp';

        // 3. 不够数 → 同 chapter fallback：math.7.ch3.* 下所有 KP
        if (rows.length < limit) {
            // 取前 4 段做 chapter prefix（math.7.ch3）
            const parts = topicCode.split('.');
            if (parts.length >= 3) {
                const chapterPrefix = parts.slice(0, 3).join('.') + '.';
                // PostgREST like operator: % 是通配符，不能 encode
                const likePattern = encodeURIComponent(chapterPrefix) + '%25';
                const siblingKps = await pgQuery(
                    `knowledge_points?code=like.${likePattern}`
                    + `&select=id,code&limit=50`
                );
                const siblingIds = siblingKps.map(k => k.id).filter(id => id !== kp.id);
                if (siblingIds.length) {
                    const need = limit - rows.length;
                    const more = await fetchQuestionsByKpIds(siblingIds, need + rows.length, difficultyMax);
                    // 去重（按 id）后补齐
                    const seen = new Set(rows.map(r => r.id));
                    for (const r of more) {
                        if (seen.has(r.id)) continue;
                        rows.push(r);
                        seen.add(r.id);
                        if (rows.length >= limit) break;
                    }
                    if (rows.length > 0) via = 'chapter_fallback';
                }
            }
        }

        const items = rows.slice(0, limit).map(normalize);

        return jsonOk({
            ok: true,
            topic_code: topicCode,
            kp_id: kp.id,
            kp_name: kp.name,
            via,
            count: items.length,
            requested: limit,
            items,
            engine_version: ENGINE_VERSION,
        });
    } catch (e) {
        return jsonErr(502, 'db_failed', e.message);
    }
}
