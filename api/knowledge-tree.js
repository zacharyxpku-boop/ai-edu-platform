// 原点智学 · 知识点树查询端点
// GET /api/knowledge-tree?subject=math&grade=7         按学科+年级
// GET /api/knowledge-tree?kp_id=math.7.ch3.kp3        单知识点 + 先修链
// GET /api/knowledge-tree?root=math.7.ch3              单章节
//
// 用途：
//   1. mastery-loop 选 topic 时拉知识点树
//   2. parent-radar 显示「先修链」（这道题卡了，因为前面 X 没掌握）
//   3. NCDM 的 Q-matrix 维度索引

export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'kt-v1.0';

let _cache = { at: 0, data: null, flat: null };

async function getOntology(origin) {
    const now = Date.now();
    if (_cache.data && (now - _cache.at) < 5 * 60 * 1000) return _cache;
    try {
        const r = await fetch(origin + '/src/curriculum/cn-k12-knowledge-ontology.json', { cache: 'no-store' });
        if (!r.ok) return { data: null };
        const data = await r.json();
        // 扁平化：kp_id → 完整节点
        const flat = {};
        Object.entries(data.subjects || {}).forEach(([subjKey, subj]) => {
            Object.entries(subj.stages || {}).forEach(([stageKey, stage]) => {
                (stage.chapters || []).forEach(ch => {
                    (ch.knowledge_points || []).forEach(kp => {
                        flat[kp.kp_id] = {
                            ...kp,
                            chapter_id: ch.chapter_id,
                            chapter_name: ch.name,
                            subject: subjKey,
                            stage_key: stageKey,
                            stage_label: stage.stage_label,
                            grade: parseInt(stageKey.replace(/\D/g, ''), 10) || null,
                            standard_ref: ch.standard_ref || null,
                            textbook_chapter: ch.textbook_chapter || null,
                        };
                    });
                });
            });
        });
        _cache = { at: now, data, flat };
        return _cache;
    } catch (e) { return { data: null }; }
}

function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ ok: false, error: code, message: msg }), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

// 递归找先修链（最多 5 层防循环）
function buildPrereqChain(kpId, flat, depth = 0, seen = new Set()) {
    if (depth > 5 || seen.has(kpId)) return [];
    seen.add(kpId);
    const node = flat[kpId];
    if (!node || !node.prerequisites) return [];
    const chain = [];
    node.prerequisites.forEach(pid => {
        const p = flat[pid];
        if (p) {
            chain.push({
                kp_id: pid, name: p.name,
                chapter_id: p.chapter_id, chapter_name: p.chapter_name,
                grade: p.grade, depth: depth + 1
            });
            chain.push(...buildPrereqChain(pid, flat, depth + 1, seen));
        }
    });
    return chain;
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    if (req.method !== 'GET') return jsonErr(405, 'method_not_allowed', '只接受 GET');

    const url = new URL(req.url);
    const { data, flat } = await getOntology(url.origin);
    if (!data) return jsonErr(503, 'ontology_unavailable', '知识点本体加载失败');

    const kpId = url.searchParams.get('kp_id');
    const root = url.searchParams.get('root');
    const subject = url.searchParams.get('subject');
    const grade = url.searchParams.get('grade');

    // 单知识点 + 先修链
    if (kpId) {
        const node = flat[kpId];
        if (!node) return jsonErr(404, 'kp_not_found', `kp_id=${kpId} 不在本体中`);
        return new Response(JSON.stringify({
            kp: node,
            prerequisites_chain: buildPrereqChain(kpId, flat),
            engine_version: ENGINE_VERSION,
        }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
    }

    // 单章节
    if (root) {
        const chapterKps = Object.values(flat).filter(n => n.chapter_id === root);
        if (!chapterKps.length) return jsonErr(404, 'chapter_not_found', `chapter_id=${root} 不存在`);
        return new Response(JSON.stringify({
            chapter_id: root,
            chapter_name: chapterKps[0].chapter_name,
            knowledge_points: chapterKps,
            count: chapterKps.length,
            engine_version: ENGINE_VERSION,
        }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
    }

    // 学科 + 年级
    if (subject) {
        const subj = data.subjects[subject];
        if (!subj) return jsonErr(404, 'subject_not_found', `subject=${subject} 不存在`);
        if (grade) {
            const stageKey = `junior_g${grade}`;
            const stage = subj.stages[stageKey];
            if (!stage) return jsonErr(404, 'stage_not_found', `${subject} grade=${grade} 不存在`);
            return new Response(JSON.stringify({
                subject, grade: parseInt(grade, 10),
                stage: stage.stage_label,
                chapters: stage.chapters,
                engine_version: ENGINE_VERSION,
            }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
        }
        return new Response(JSON.stringify({
            subject, name: subj.name, primary_publisher: subj.primary_publisher,
            stages: Object.entries(subj.stages).map(([k, v]) => ({
                stage_key: k, stage_label: v.stage_label, chapter_count: v.chapters.length
            })),
            engine_version: ENGINE_VERSION,
        }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
    }

    // 全树概览
    return new Response(JSON.stringify({
        subjects: Object.keys(data.subjects),
        stats: data._stats,
        todo: data._todo,
        engine_version: ENGINE_VERSION,
    }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
