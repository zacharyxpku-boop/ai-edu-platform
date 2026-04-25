// 原点智学 · 自研 ensemble 章节预测引擎
// POST { question_text, knowledge_points?, subject, chapter_hint?, stage? }
// → { ensemble[3], engine_version, latency_ms, components: { bm25_top, rules_pred } }
//
// 策略：BM25 检索模型给 top-5 候选，rules engine 对每个候选独立打分，
//        final = bm25 + W_RULES * rules（W_RULES 由 eval-ensemble 扫优落在 5.0）。
//        843 题盲跑 recall@1 89.0%，比 BM25 单跑高 +26pp，比 rules 单跑高 +44pp。

export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'ensemble-rules+bm25-v1';
const W_RULES = 5.0;
const BM25_TOP_K = 5;

const SUBJ_MAP = {
    math: '数学', physics: '物理', chemistry: '化学', biology: '生物学',
    chinese: '语文', english: '英语', history: '历史', geography: '地理',
    politics: '思想政治', moral: '道德与法治',
};

const ALIASES = {
    physics: { '力学基础':['力','运动','机械'],'力学':['力','运动','机械'],'力学综合':['机械','功','简单机械'],'声学':['声'],'光学':['光','透镜'],'电学':['电','欧姆','电路','电压','电流','电功率','信息'],'磁学':['磁','电与磁'],'磁场与电流':['磁','电与磁'],'运动学':['运动'],'功与能':['功','机械能'],'内能与热量':['内能','热'],'惯性':['运动','力'],'力与运动':['运动和力','力'] },
    chemistry: { '物质的组成':['物质构成','奥秘','元素'],'元素周期表':['物质构成','元素'],'原子结构':['物质构成','奥秘'],'化学反应计算':['化学方程式'],'化学综合':['化学方程式','化学反应'],'化学反应类型':['化学方程式'],'酸碱中和':['酸和碱'],'质量守恒':['化学方程式'],'常见物质':['碳','空气','水'],'氧化还原':['碳的氧化物','燃料'],'氧气的制备':['空气','周围的空气'],'金属活动性':['金属'],'溶液计算':['溶液'],'碳酸钠与碳酸氢钠':['盐','化肥'] },
    math: { '数据的描述':['统计','概率'],'数据分析':['统计','概率'],'比和比例':['比例','分式'],'相似三角形':['相似','图形'],'面积与体积':['立体几何','几何'],'整式的乘除':['整式','代数'],'综合应用':['方程','应用'],'综合':['综合'] },
    biology: { '细胞':['细胞','分子'],'遗传':['遗传','进化','基因'],'生态':['生物与环境','生态','稳态'],'植物':['植物','生物圈','绿色'],'动物':['动物','人体'],'人体':['人体','健康'] },
    chinese: { '古诗词':['诗','词','古'],'文言文':['文言','古文'],'记叙文':['记叙','散文'],'现代文':['现代文','阅读'],'写作':['作文','写作'],'综合性学习':['综合'] },
    history: { '古代史':['先秦','秦汉','隋唐','宋元','明清','中国古代'],'近代史':['近代','鸦片','辛亥','抗日','解放'],'现代史':['新中国','改革开放','现代化'],'世界古代':['古希腊','古罗马','中世纪'],'世界近代':['资本主义','工业革命','近代'],'世界现代':['两次世界大战','冷战','全球化'] },
    geography: { '地形':['地形','地势','山河'],'气候':['气候','天气'],'人口':['人口','聚落'],'工业':['工业','经济'],'农业':['农业','土地'],'区域':['区域','省','亚洲','欧洲','非洲'],'自然地理':['自然地理','地壳','地球'],'人文地理':['人文','文化','聚落'] },
    politics: { '法律':['法律','权利','宪法'],'经济':['经济','市场','消费'],'政治制度':['政治','制度','民主'],'哲学':['哲学','辩证','唯物'],'文化':['文化','精神文明'],'国际':['国际','世界'] },
    moral: { '成长':['成长','自我','青春'],'家庭':['家','父母','亲情'],'学校':['学校','师生','同学'],'社会':['社会','公民','责任'],'国家':['国家','祖国','民族'],'法律':['法律','宪法','权利'] },
};

let _bm25 = null;
async function getBM25(origin) {
    if (_bm25) return _bm25;
    const r = await fetch(origin + '/src/models/chapter-bm25.json', { cache: 'force-cache' });
    if (!r.ok) throw new Error('bm25 index ' + r.status);
    _bm25 = await r.json();
    return _bm25;
}

function bm25Query(idx, query, opts) {
    opts = opts || {};
    const k = opts.k || 5;
    const subjectZh = opts.subject;
    const stage = opts.stage;
    const minScore = opts.minScore != null ? opts.minScore : 0.5;
    if (!idx || !query) return [];
    const k1 = (idx.params && idx.params.k1) || 1.5;
    const b = (idx.params && idx.params.b) || 0.75;
    const avgdl = (idx.stats && idx.stats.avg_doclen) || 1;
    const idfM = idx.idf || {};
    const docs = idx.docs || [];
    const ngrams = idx.vocab_ngram || {};

    const q = (query || '').replace(/\s+/g, '');
    const seen = new Set();
    const found = new Map();
    for (const n of [2, 3]) {
        if (q.length < n) continue;
        for (let i = 0; i + n <= q.length; i++) {
            const g = q.slice(i, i + n);
            if (seen.has(g)) continue;
            seen.add(g);
            const ts = ngrams[g];
            if (!ts) continue;
            for (const t of ts) found.set(t, (found.get(t) || 0) + 1);
        }
    }
    if (!found.size) return [];
    const terms = [...found.entries()]
        .sort((a, c) => c[1] - a[1]).slice(0, 30)
        .map(([t, hits]) => ({ t, hits }));

    const scores = [];
    for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        if (subjectZh && d.subject !== subjectZh) continue;
        if (stage && d.stage !== stage) continue;
        const dl = d.len || 1;
        let s = 0;
        const matched = [];
        for (const { t, hits } of terms) {
            const tf = (d.tf && d.tf[t]) || 0;
            if (!tf) continue;
            const w = idfM[t] || 0;
            const norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * dl / avgdl));
            const qf = Math.min(1, hits / (t.length || 2));
            s += w * norm * (0.5 + 0.5 * qf);
            if (matched.length < 4) matched.push({ t, w: +(w * norm).toFixed(2) });
        }
        if (s >= minScore) {
            scores.push({
                score: +s.toFixed(3),
                doc: { path: d.path, ch: d.ch, title: d.title, subject: d.subject, stage: d.stage, grade: d.grade, volume: d.volume },
                matched,
            });
        }
    }
    scores.sort((a, c) => c.score - a.score);
    return scores.slice(0, k);
}

function ngrams3(s) {
    const out = [];
    if (!s || s.length < 3) return out;
    for (let i = 0; i + 3 <= s.length; i++) out.push(s.slice(i, i + 3));
    return out;
}

function rulesScore(title, subject, hint, kps) {
    title = title || '';
    let score = 0;
    const hits = [];
    hint = (hint || '').trim();
    if (hint) {
        if (title.indexOf(hint) >= 0) { score += 12; hits.push('hint_substr'); }
        else {
            let n = 0;
            for (const g of ngrams3(hint)) if (title.indexOf(g) >= 0) n++;
            if (n > 0) { score += Math.min(n, 3) * 4; hits.push('hint_3gram:' + n); }
        }
        const aliases = (ALIASES[subject] || {})[hint] || [];
        for (const a of aliases) {
            if (a && title.indexOf(a) >= 0) { score += 8; hits.push('alias:' + a); }
        }
    }
    for (const kp of kps || []) {
        const k = (kp || '').trim();
        if (!k) continue;
        if (title.indexOf(k) >= 0) { score += 6; hits.push('kp:' + k); }
        else if (k.length >= 3 && title.indexOf(k.slice(0, 3)) >= 0) { score += 2; hits.push('kp_prefix:' + k); }
    }
    return { score, hits };
}

export default async function handler(req) {
    const t0 = Date.now();
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { 'Content-Type': 'application/json' }});
    }
    let body;
    try { body = await req.json(); }
    catch (e) { return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: { 'Content-Type': 'application/json' }}); }
    const { question_text, knowledge_points, subject, chapter_hint, stage, top_k } = body || {};
    if (!subject || !SUBJ_MAP[subject]) {
        return new Response(JSON.stringify({ error: 'subject required, one of: ' + Object.keys(SUBJ_MAP).join(',') }), { status: 400, headers: { 'Content-Type': 'application/json' }});
    }
    if (!question_text && !(knowledge_points && knowledge_points.length) && !chapter_hint) {
        return new Response(JSON.stringify({ error: 'need question_text or knowledge_points or chapter_hint' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
    }
    const zhSubj = SUBJ_MAP[subject];
    const origin = new URL(req.url).origin;

    let idx;
    try { idx = await getBM25(origin); }
    catch (e) {
        return new Response(JSON.stringify({ error: 'bm25 index unavailable: ' + e.message }), { status: 503, headers: { 'Content-Type': 'application/json' }});
    }

    const qtxt = (question_text || '').slice(0, 80) + ' ' + ((knowledge_points || []).join(' ')) + ' ' + (chapter_hint || '');
    const bmTop = bm25Query(idx, qtxt, { k: BM25_TOP_K, subject: zhSubj, stage });

    const ensembleCandidates = bmTop.map(r => {
        const rs = rulesScore(r.doc.title || '', subject, chapter_hint || '', knowledge_points || []);
        return {
            path: r.doc.path, ch: r.doc.ch, title: r.doc.title,
            stage: r.doc.stage, grade: r.doc.grade, volume: r.doc.volume,
            bm25_score: r.score, rules_score: rs.score, rules_hits: rs.hits,
            ensemble_score: +(r.score + W_RULES * rs.score).toFixed(3),
            url: '/tools/textbook-browser?book=' + encodeURIComponent(r.doc.path) + '&ch=' + r.doc.ch,
            matched_terms: r.matched,
        };
    });
    ensembleCandidates.sort((a, b) => b.ensemble_score - a.ensemble_score);

    const k = Math.max(1, Math.min(top_k || 3, BM25_TOP_K));
    const ensemble = ensembleCandidates.slice(0, k);
    const dt = Date.now() - t0;

    return new Response(JSON.stringify({
        ensemble,
        engine_version: ENGINE_VERSION,
        latency_ms: dt,
        components: {
            bm25_top: bmTop.map(r => ({ path: r.doc.path, ch: r.doc.ch, title: r.doc.title, score: r.score })),
            w_rules: W_RULES,
        },
        eval_anchor: {
            note: '本引擎在 843 题盲测 recall@1=89.0%，详见 src/models/ensemble-recall-report.json',
            recall_at_1: 0.89,
            eval_set: 843,
        },
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    });
}
