// 原点智学 · 苏格拉底引导检索引擎
// POST { subject, topic, grade?, knowledge_point?, mistake_l3?, student_state? }
// → { matched_prompts[], chapter_match, system_prompt, engine_version }
//
// 设计要点：
//   1. 检索源 = feynman-prompts.json（20 条精炼苏格拉底种子）+ chapter-match 章节
//   2. 评分：subject 精确 + topic 子串/3-gram + knowledge_point 命中
//   3. 输出 system_prompt 直接喂给 tutor，包含四步法 + matched seeds
//   4. mistake_l3 命中时优先选 common_gaps 含相关词的种子
//
// 调用：fetch('/api/retrieve', { method:'POST', body: JSON.stringify({...}) })

export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'retrieve-v1.0-feynman+chapter';

const SUBJ_ALIAS = {
    math: '数学', physics: '物理', chemistry: '化学', biology: '生物学',
    chinese: '语文', english: '英语', history: '历史', geography: '地理'
};

let _cache = { at: 0, feynman: null };

// ── Fallback misconception pool · feynman 加载失败时的兜底数据源 ──
let _fallbackPoolCache = null;
async function loadFallbackPool(origin) {
    if (_fallbackPoolCache) return _fallbackPoolCache;
    try {
        const mod = await import('./_fallback-misconception-pool.json', { assert: { type: 'json' } });
        const data = mod?.default || mod;
        if (data && Array.isArray(data.entries)) { _fallbackPoolCache = data; return data; }
    } catch (_) {}
    try {
        const r = await fetch(origin + '/api/_fallback-misconception-pool.json', { cache: 'no-store' });
        if (r.ok) {
            const data = await r.json();
            if (data && Array.isArray(data.entries)) { _fallbackPoolCache = data; return data; }
        }
    } catch (_) {}
    return null;
}

async function getFeynman(origin) {
    const now = Date.now();
    if (_cache.feynman && (now - _cache.at) < 5 * 60 * 1000) return _cache.feynman;
    try {
        const r = await fetch(origin + '/src/curriculum/feynman-prompts.json', { cache: 'no-store' });
        if (!r.ok) return null;
        const data = await r.json();
        _cache = { at: now, feynman: data };
        return data;
    } catch (e) { return null; }
}

function ngrams(s, n) {
    const arr = [];
    const str = String(s || '').trim();
    if (str.length < n) return arr;
    for (let i = 0; i <= str.length - n; i++) arr.push(str.slice(i, i + n));
    return arr;
}

function scoreSeed(seed, subjectZh, topic, grade, kpHint, mistakeL3) {
    let score = 0;
    const hits = [];

    if (seed.subject === subjectZh) { score += 10; hits.push('subj_exact'); }
    else return { score: 0, hits: [] }; // 学科不对直接 0

    const seedTopic = String(seed.topic || '');
    const t = String(topic || '').trim();
    if (t) {
        if (seedTopic.indexOf(t) >= 0 || t.indexOf(seedTopic) >= 0) { score += 12; hits.push('topic_substr'); }
        else {
            const grams = ngrams(t, 2);
            let gn = 0;
            grams.forEach(g => { if (seedTopic.indexOf(g) >= 0) gn++; });
            if (gn > 0) { score += Math.min(gn, 4) * 2; hits.push('topic_2gram:' + gn); }
        }
    }

    if (grade && seed.grade && seed.grade.indexOf(grade) >= 0) { score += 4; hits.push('grade'); }

    if (kpHint) {
        const kp = String(kpHint).trim();
        const blob = (seedTopic + ' ' + (seed.seed_question || '') + ' ' + (seed.common_gaps || []).join(' '));
        if (blob.indexOf(kp) >= 0) { score += 5; hits.push('kp_in_blob'); }
    }

    // mistake_l3 是 64 类标签，用 l3 名（如 'definition_vague.wrong_boundary'）后缀关键词匹配
    if (mistakeL3) {
        const l3Last = String(mistakeL3).split('.').pop().replace(/_/g, ' ');
        const gaps = (seed.common_gaps || []).join(' ');
        const probes = (seed.probe_questions || []).join(' ');
        if (gaps.toLowerCase().indexOf(l3Last.toLowerCase()) >= 0) { score += 6; hits.push('l3_in_gaps'); }
        if (probes.toLowerCase().indexOf(l3Last.toLowerCase()) >= 0) { score += 3; hits.push('l3_in_probes'); }
    }

    return { score, hits };
}

function buildSystemPrompt(feynman, matched, mistakeContext) {
    const lines = [];
    lines.push('你是原点 AI 私教，遵循费曼技巧四步法引导学生。');
    lines.push('');
    lines.push('=== 四步法（按顺序推进）===');
    (feynman.four_steps || []).forEach(s => {
        lines.push(`Step ${s.step} · ${s.name}：${s.goal}`);
    });
    lines.push('');
    lines.push('=== 角色铁律 ===');
    lines.push('1. 不直接给答案。每轮只追问 1 个最关键的问题');
    lines.push('2. 学生卡住时先共情再给最小提示，不要一次给全部');
    lines.push('3. 用学生熟悉的生活场景做类比，避免堆术语');
    lines.push('4. 答案对时点赞要具体（指出对在哪一步），别说「不错继续」这种废话');
    lines.push('5. 答案错时不直接说「错了」，先问「你是怎么想的」');
    lines.push('');

    if (mistakeContext && mistakeContext.l3_tag && mistakeContext.l3_tag.length) {
        lines.push('=== 当前学生错点（优先针对）===');
        lines.push(`错误根因：${mistakeContext.root_cause || '未知'}`);
        lines.push(`错误类型：${(mistakeContext.l3_tag || []).join(' / ')}`);
        if (mistakeContext.suggested_drill) {
            lines.push(`官方建议练习：${mistakeContext.suggested_drill}`);
        }
        lines.push('');
    }

    if (matched && matched.length) {
        lines.push('=== 同类话题的引导参考（few-shot）===');
        matched.slice(0, 3).forEach((m, i) => {
            lines.push(`\n【参考 ${i + 1}】话题：${m.topic}`);
            lines.push(`种子提问：${m.seed_question}`);
            if (m.common_gaps && m.common_gaps.length) {
                lines.push(`常见误区：${m.common_gaps.slice(0, 3).join('；')}`);
            }
            if (m.probe_questions && m.probe_questions.length) {
                lines.push(`探询问题（按需挑选）：`);
                m.probe_questions.slice(0, 4).forEach((q, j) => lines.push(`  ${j + 1}. ${q}`));
            }
        });
        lines.push('');
    }

    lines.push('开始对话。第一句话用「你能用自己的话告诉我...」开场。');
    return lines.join('\n');
}

function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ error: code, message: msg }), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
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

    let body;
    try { body = await req.json(); }
    catch (e) { return jsonErr(400, 'bad_json', '请求体不是合法 JSON'); }

    const { subject, topic, grade, knowledge_point, mistake_l3, mistake_context, student_state, fetch_chapter } = body || {};
    if (!subject || !topic) {
        return jsonErr(400, 'missing_fields', 'subject + topic 必填');
    }
    const subjectZh = SUBJ_ALIAS[subject] || subject;

    const origin = new URL(req.url).origin;
    const feynman = await getFeynman(origin);
    if (!feynman) {
        // ── feynman 加载失败时走 fallback 池兜底，不直接 503 ──
        // 从 misconception 池找跟 topic 字面相关的几条，合成最小 system_prompt 给 tutor
        const fb = await loadFallbackPool(origin);
        if (fb && Array.isArray(fb.entries)) {
            const probe = String(topic || '').toLowerCase();
            const hits = fb.entries
                .map(e => {
                    const blob = `${e.kp_name || ''} ${e.label_cn || ''} ${e.wrong_pattern || ''}`.toLowerCase();
                    let score = 0;
                    if (probe && blob.indexOf(probe) >= 0) score += 5;
                    return { ...e, _score: score };
                })
                .filter(x => x._score > 0)
                .slice(0, 3);
            const lines = [];
            lines.push('你是原点 AI 私教，遵循苏格拉底式引导（feynman 模板加载失败，本次走 fallback 池）。');
            lines.push('铁律：不直接给答案 · 每轮一个最关键问题 · 学生卡住先共情再给最小提示');
            if (hits.length) {
                lines.push('');
                lines.push('=== 可能相关的常见误区（参考）===');
                hits.forEach((h, i) => {
                    lines.push(`【${i + 1}】${h.label_cn}（${h.attribution}）`);
                    lines.push(`  根因：${h.root_cause_hint}`);
                    lines.push(`  下次提示：${h.remediation_cue}`);
                });
            }
            lines.push('');
            lines.push('开始对话。第一句话用「你能用自己的话告诉我...」开场。');
            return new Response(JSON.stringify({
                matched_prompts: [],
                match_count: 0,
                chapter_match: null,
                system_prompt: lines.join('\n'),
                engine_version: 'retrieve-v1.0-fallback-pool',
                fallback: true,
                fallback_hits: hits.length,
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
            });
        }
        return jsonErr(503, 'feynman_unavailable', 'feynman-prompts.json 加载失败');
    }

    // 评分排序 prompt_library 20 条
    const scored = (feynman.prompt_library || [])
        .map(seed => ({ ...seed, ...scoreSeed(seed, subjectZh, topic, grade, knowledge_point, mistake_l3) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score);

    // 可选：调 chapter-match 拿章节定位
    let chapter_match = null;
    if (fetch_chapter) {
        try {
            const r = await fetch(origin + '/api/chapter-match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject,
                    chapter_hint: topic,
                    knowledge_points: knowledge_point ? [knowledge_point] : [],
                    stage: grade ? (grade.indexOf('小') >= 0 ? 'primary' : (grade.indexOf('高') >= 0 ? 'high' : 'middle')) : undefined
                })
            });
            if (r.ok) {
                const cm = await r.json();
                chapter_match = cm.matched ? {
                    title: cm.matched.title,
                    book: cm.matched.book,
                    url: cm.matched.url,
                    score: cm.matched.score
                } : null;
            }
        } catch (e) {}
    }

    const top3 = scored.slice(0, 3);
    const system_prompt = buildSystemPrompt(feynman, top3, mistake_context);

    return new Response(JSON.stringify({
        matched_prompts: top3.map(m => ({
            id: m.id,
            subject: m.subject,
            grade: m.grade,
            topic: m.topic,
            seed_question: m.seed_question,
            score: m.score,
            hits: m.hits
        })),
        match_count: scored.length,
        chapter_match,
        system_prompt,
        engine_version: ENGINE_VERSION,
        stats: {
            seeds_total: (feynman.prompt_library || []).length,
            seeds_matched: scored.length,
            student_mastery: student_state?.mastery ?? null
        }
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' }
    });
}
