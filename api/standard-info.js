// 原点智学 · 课标对齐查询端点
// GET /api/standard-info?topic_id=math.7.eq.linear
// → { topic, standard, content_requirements, academic_requirements, key_competencies, frequent_misconceptions }
//
// 用途：
//   1. parent-radar / mastery-loop 旁路展示「这道题对应课标第 X 条」（合规背书）
//   2. 家长 4 周提分报告：「攻克的 14 个知识点全部对应教育部 2022 课标」
//   3. /api/diagnose 归因 prompt 增强：把 frequent_misconceptions 当 hint 喂给 LLM

export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'standard-info-v1.0';

let _cache = { at: 0, data: null };

async function getAlignment(origin) {
    const now = Date.now();
    if (_cache.data && (now - _cache.at) < 5 * 60 * 1000) return _cache.data;
    try {
        const r = await fetch(origin + '/src/curriculum/course-standard-alignment.json', { cache: 'no-store' });
        if (!r.ok) return null;
        const d = await r.json();
        _cache = { at: now, data: d };
        return d;
    } catch (e) { return null; }
}

function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ ok: false, error: code, message: msg }), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' }
        });
    }
    if (req.method !== 'GET') return jsonErr(405, 'method_not_allowed', '只接受 GET');

    const url = new URL(req.url);
    const topicId = url.searchParams.get('topic_id');
    const subject = url.searchParams.get('subject');
    const grade = url.searchParams.get('grade');

    const origin = url.origin;
    const align = await getAlignment(origin);
    if (!align) return jsonErr(503, 'alignment_unavailable', '课标对齐文件加载失败');

    // 单 topic 查询
    if (topicId) {
        const m = align.mappings[topicId];
        if (!m) {
            return new Response(JSON.stringify({
                ok: false,
                error: 'topic_not_aligned',
                message: `topic_id=${topicId} 暂未对齐到课标，可对齐覆盖见 _coverage_status`,
                coverage: align._coverage_status,
                engine_version: ENGINE_VERSION
            }), { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
        }
        const subj = m.subject || 'math';
        const stage = m.grade && m.grade >= 10 ? 'senior' : 'junior';
        const stdMeta = align.standards[subj]?.[stage];
        return new Response(JSON.stringify({
            topic_id: topicId,
            topic_name: m.topic_name,
            subject: m.subject,
            grade: m.grade,
            publisher: m.publisher,
            textbook_chapter: m.textbook_chapter,
            standard: stdMeta ? {
                name: stdMeta.name,
                issued_by: stdMeta.issued_by,
                doc_no: stdMeta.doc_no,
                url: stdMeta.url,
            } : null,
            stage: m.stage,
            domain: m.domain,
            subdomain: m.subdomain,
            content_requirements: m.content_requirements || [],
            academic_requirements: m.academic_requirements || null,
            key_competencies: m.key_competencies || [],
            frequent_misconceptions: m.frequent_misconceptions || [],
            engine_version: ENGINE_VERSION
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
        });
    }

    // 列表/筛选查询
    const all = Object.entries(align.mappings).map(([id, m]) => ({
        topic_id: id, topic_name: m.topic_name, subject: m.subject,
        grade: m.grade, domain: m.domain, subdomain: m.subdomain
    }));
    const filtered = all.filter(t =>
        (!subject || t.subject === subject) &&
        (!grade || String(t.grade) === String(grade))
    );

    return new Response(JSON.stringify({
        count: filtered.length,
        topics: filtered,
        coverage: align._coverage_status,
        engine_version: ENGINE_VERSION
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
    });
}
