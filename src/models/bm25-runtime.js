// 原点自研「章节检索模型 v1 · BM25-jieba」运行时
// ----------------------------------------------------
// 1.8 MB 索引一次性 fetch 进浏览器，BM25 打分在客户端跑，离线可用，0 token。
// 索引产物来自 scripts/build-chapter-bm25.py。
//
// 用法：
//   import { loadBM25, queryBM25 } from '/src/models/bm25-runtime.js';
//   const idx = await loadBM25();
//   const top = queryBM25(idx, '凸透镜成像规律', { k: 5, subject: '物理' });
//
// 工程权衡：
//   · 不用 embedding/向量库：272 章语料小，倒排+BM25 比 cos sim 快且可解释
//   · 查询端不带 jieba：用 char 2/3-gram 反查 vocab_ngram 拼回词项，跑在 edge/browser 都行
//   · 章节标题 ×3 重复进语料，title 命中权重天然更高

let _bm25 = null;

export async function loadBM25(url = '/src/models/chapter-bm25.json') {
    if (_bm25) return _bm25;
    const res = await fetch(url);
    if (!res.ok) throw new Error('failed to fetch bm25 index: ' + res.status);
    _bm25 = await res.json();
    return _bm25;
}

// 查询端 tokenizer：char 2-gram + 3-gram，反查 vocab_ngram 拿回词项
function ngramTerms(query, ngrams) {
    const found = new Map(); // term → 命中 ngram 数
    const q = (query || '').replace(/\s+/g, '');
    if (!q) return found;
    const seen = new Set();
    for (const n of [2, 3]) {
        if (q.length < n) continue;
        for (let i = 0; i + n <= q.length; i++) {
            const g = q.slice(i, i + n);
            if (seen.has(g)) continue;
            seen.add(g);
            const terms = ngrams[g];
            if (!terms) continue;
            for (const t of terms) {
                found.set(t, (found.get(t) || 0) + 1);
            }
        }
    }
    return found;
}

export function queryBM25(idx, query, opts = {}) {
    if (!idx || !query) return [];
    const { k = 5, subject, stage, minScore = 0.5 } = opts;
    const k1 = (idx.params && idx.params.k1) || 1.5;
    const b = (idx.params && idx.params.b) || 0.75;
    const avgdl = (idx.stats && idx.stats.avg_doclen) || 1;
    const idf = idx.idf || {};
    const docs = idx.docs || [];
    const ngrams = idx.vocab_ngram || {};

    // 1) query → 词项集合（带匹配强度）
    const termHits = ngramTerms(query, ngrams);
    if (!termHits.size) return [];
    // 排个序，取 top-30 避免极端长 query 匹爆
    const terms = [...termHits.entries()]
        .sort((a, c) => c[1] - a[1])
        .slice(0, 30)
        .map(([t, hits]) => ({ t, hits }));

    // 2) 对每个 doc 求 BM25 分
    const scores = [];
    for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        if (subject && d.subject !== subject) continue;
        if (stage && d.stage !== stage) continue;
        const dl = d.len || 1;
        let s = 0;
        const matched = [];
        for (const { t, hits } of terms) {
            const tf = (d.tf && d.tf[t]) || 0;
            if (!tf) continue;
            const w = idf[t] || 0;
            const norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * dl / avgdl));
            // 查询端 ngram 命中强度作为系数（最多 ×1.0，避免 dominate）
            const qfactor = Math.min(1, hits / (t.length || 2));
            s += w * norm * (0.5 + 0.5 * qfactor);
            if (matched.length < 6) matched.push({ t, w: +(w * norm).toFixed(2), tf });
        }
        if (s >= minScore) {
            scores.push({
                score: +s.toFixed(3),
                doc: { id: d.id, path: d.path, ch: d.ch, title: d.title,
                       subject: d.subject, stage: d.stage, grade: d.grade, volume: d.volume },
                matched,
            });
        }
    }
    scores.sort((a, c) => c.score - a.score);
    return scores.slice(0, k);
}

// 简易自检：浏览器 console 里直接 window._bm25test('凸透镜成像')
if (typeof window !== 'undefined') {
    window._bm25test = async function(q, opts) {
        const idx = await loadBM25();
        const r = queryBM25(idx, q, opts || {});
        console.table(r.map(x => ({ score: x.score, title: x.doc.title, path: x.doc.path, ch: x.doc.ch })));
        return r;
    };
}
