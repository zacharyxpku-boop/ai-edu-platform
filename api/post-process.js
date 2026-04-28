// 原点智学 · /api/post-process · LLM 输出 hallucination 启发式检测层
//
// 不调 LLM，只跑 6 类正则。设计目的：在 tutor-chat / mentor-reply-draft 等
// 流式响应累积完成后，用纯启发式扫一遍输出，把疑似编造的内容打 flag 到 dialogue
// meta，再把高严重度异步推到 /api/moderation 走人工审核。
//
// 对齐 Khanmigo 风险材料 7.1：
//   「人文/科学领域可能重复或事实错误」
//   「AI 可能啰嗦」
//   「学生会要求少说点」
//
// API：
//   POST { response, dialogue_id?, source? } → { ok, suspicious_flags[], confidence }
//   GET  ?recent=N → { ok, recent: [...] }   admin 看板用
//
// 也可被服务端代码 import { postProcess } 直接调用，避免 HTTP round trip。

export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'post-process-v1.0';

// 6 类 hallucination 检测正则（全局匹配，可统计次数）
const HALLUCINATION_PATTERNS = {
    // 1. fake_research · 假装引用研究
    fake_research: /(根据\s*[一-龥]{2,8}\s*研究|某项研究|研究表明|权威数据|多项研究显示)/g,
    // 2. fake_year_event · 编造年份+政策事件
    fake_year_event: /(\d{4})\s*年.{0,15}(改革|颁布|发布|实施|推行)/g,
    // 3. fake_authority · 编造官方文件
    fake_authority: /(国家.{0,4}规定|教育部.{0,8}文件|官方.{0,4}通知)/g,
    // 4. fake_stat · 编造统计百分比
    fake_stat: /\d{2,}\s*%\s*的(学生|孩子|家长|考生|用户)/g,
    // 5. invented_problem · 假装引用真题
    invented_problem: /(题目编号\s*\d+|2024年.{0,10}真题|某省.{0,10}试题|历年真题第\s*\d+\s*题)/g,
    // 6. over_certain · 绝对化措辞（K12 教学场景里几乎一定是过度自信）
    over_certain: /(绝对正确|百分百|肯定是|必然如此|毫无疑问)/g,
};

// 内存最近 200 条 flagged 缓存（admin 看板用，进程重启会丢，要长期保留走 moderation_logs）
const RECENT_FLAGGED = [];
const RECENT_MAX = 200;

/**
 * 核心检测函数。可被服务端代码同步调用，也是 HTTP handler 内部入口。
 * @param {string} response - LLM 完整输出文本
 * @returns {{ok:boolean, suspicious_flags:Array, confidence:number}}
 */
export function postProcess(response) {
    const text = String(response || '');
    const flags = [];

    for (const [name, re] of Object.entries(HALLUCINATION_PATTERNS)) {
        // 重置 lastIndex（全局正则在多次调用间会污染状态）
        re.lastIndex = 0;
        const matches = [...text.matchAll(re)];
        if (matches.length) {
            flags.push({
                category: name,
                count: matches.length,
                samples: matches.slice(0, 3).map(m => m[0]),
                severity: matches.length >= 2 ? 4 : 2,
            });
        }
    }

    // confidence 计算：
    //   无 flag → 1.0
    //   有 severity ≥ 4 → 0.3（至少一类编造命中 ≥ 2 次）
    //   只有 severity = 2 → 0.7（疑似但单点）
    let confidence;
    if (flags.length === 0) confidence = 1.0;
    else if (flags.some(f => f.severity >= 4)) confidence = 0.3;
    else confidence = 0.7;

    return {
        ok: true,
        suspicious_flags: flags,
        confidence,
        engine_version: ENGINE_VERSION,
    };
}

// 推一条 flagged 进近期缓存
function recordRecent(entry) {
    RECENT_FLAGGED.unshift({
        ts: new Date().toISOString(),
        ...entry,
    });
    if (RECENT_FLAGGED.length > RECENT_MAX) {
        RECENT_FLAGGED.length = RECENT_MAX;
    }
}

function jsonResp(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
        },
    });
}
function jsonErr(status, code, msg) {
    return jsonResp({ ok: false, error: code, message: msg }, status);
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

    // GET ?recent=N → admin 看板查最近 N 条 flagged 响应
    if (req.method === 'GET') {
        const url = new URL(req.url);
        const nRaw = parseInt(url.searchParams.get('recent') || '20', 10);
        const n = Math.max(1, Math.min(RECENT_MAX, isNaN(nRaw) ? 20 : nRaw));
        return jsonResp({
            ok: true,
            count: RECENT_FLAGGED.length,
            recent: RECENT_FLAGGED.slice(0, n),
            engine_version: ENGINE_VERSION,
        });
    }

    if (req.method !== 'POST') {
        return jsonErr(405, 'method_not_allowed', '只接受 POST 或 GET');
    }

    let body;
    try { body = await req.json(); }
    catch (e) { return jsonErr(400, 'bad_json', '请求体不是合法 JSON'); }

    const { response, dialogue_id, source } = body || {};
    if (typeof response !== 'string' || !response) {
        return jsonErr(400, 'bad_response', 'response 必填且必须是字符串');
    }

    const safeResponse = response.slice(0, 10000);
    const result = postProcess(safeResponse);

    // 只在有 flag 时才推近期缓存（清白响应不占位）
    if (result.suspicious_flags.length > 0) {
        recordRecent({
            dialogue_id: dialogue_id || null,
            source: source || null,
            excerpt: safeResponse.slice(0, 300),
            confidence: result.confidence,
            flags: result.suspicious_flags,
        });
    }

    return jsonResp(result);
}
