import { clientRateKey, json, rateLimit, readJson } from '../../lib/mini-shared.js';

export const config = { runtime: 'edge' };

// 题库在线拉题：Supabase qbank/ 存储桶 → 主题牌组（第一步引导卡，不给最终答案）
const INDEX_PATHS = [
    'xiaoxue_shuxue/index.json',
    'chuzhong_shuxue/index.json',
    'xiaoxue_yuwen/index.json',
    'chuzhong_yingyu/index.json'
];
const TOPIC_ALIASES = {
    '小数乘法': ['小数运算', '购物消费'],
    '小数除法': ['小数运算'],
    '小数运算': ['小数运算', '购物消费'],
    '小数点移动': ['小数运算'],
    '分数': ['分数运算'],
    '认识分数': ['分数运算'],
    '分数运算': ['分数运算'],
    '约分': ['分数运算'],
    '通分': ['分数运算'],
    '面积': ['面积计算'],
    '面积计算': ['面积计算'],
    '图形面积': ['面积计算'],
    '组合图形': ['面积计算'],
    '混合运算': ['小数运算', '和差问题'],
    '四则混合运算': ['小数运算', '分数运算'],
    '运算顺序': ['小数运算', '分数运算'],
    '认识钟表': ['时间计算'],
    '钟表': ['时间计算'],
    '时间计算': ['时间计算'],
    '长度单位': ['时间计算'],
    '应用题': ['综合应用', '行程问题', '和差问题'],
    '计算检查': ['小数运算', '分数运算'],
    '行程问题': ['行程问题'],
    '路程速度时间': ['行程问题'],
    '速度问题': ['行程问题'],
    '相遇追及': ['行程问题'],
    '百分数应用': ['百分数应用'],
    '百分数': ['百分数应用'],
    '折扣': ['百分数应用', '购物消费'],
    '增长率': ['百分数应用'],
    '平均数': ['平均数'],
    '统计': ['平均数'],
    '平均值': ['平均数'],
    '倍数关系': ['倍数关系'],
    '倍数': ['倍数关系'],
    '和差问题': ['和差问题'],
    '和差': ['和差问题'],
    '差倍': ['和差问题', '倍数关系'],
    '工程问题': ['工程问题'],
    '工程': ['工程问题'],
    '效率': ['工程问题'],
    '比例与比': ['比例与比'],
    '比例': ['比例与比'],
    '比': ['比例与比'],
    '七年级计算': ['七年级数学计算'],
    '初一计算': ['七年级数学计算'],
    '八年级计算': ['八年级数学计算'],
    '初二计算': ['八年级数学计算'],
    '九年级计算': ['九年级数学计算'],
    '初三计算': ['九年级数学计算'],
    '古诗词接句': ['古诗词背诵'],
    '古诗词背诵': ['古诗词背诵'],
    '古诗词作者': ['古诗词作者'],
    '诗词作者': ['古诗词作者'],
    '英语单词': ['英语单词'],
    '英文单词': ['英语单词'],
    '词汇': ['英语单词'],
    '阅读理解': ['英语阅读', '语文语言运用']
};
let indexCache = null;
let indexCacheAt = 0;

function firstStepFromEquation(equation) {
    const eq = String(equation || '').replace(/^x=/, '');
    const paren = eq.match(/\(([^()]{1,14})\)/);
    if (paren) return `先算括号里的 ${paren[1]}`;
    const m = eq.match(/^(\d+(?:\.\d+)?%?)([+\-*/])(\d+(?:\.\d+)?%?)/);
    if (m) {
        const opName = { '+': '加', '-': '减', '*': '乘', '/': '除以' }[m[2]];
        return `先用 ${m[1]} ${opName} ${m[3]}`;
    }
    return '先把已知条件圈出来';
}

async function fetchObject(env, objectPath) {
    const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/qbank/${objectPath}`, {
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
    });
    if (!res.ok) return null;
    return res.json();
}

function pickRows(rows, limit) {
    const pool = rows.slice();
    const picked = [];
    while (picked.length < limit && pool.length) {
        picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picked;
}

function topicCandidates(topic) {
    const cleaned = String(topic || '').trim();
    const aliases = TOPIC_ALIASES[cleaned] || [];
    return [cleaned, ...aliases].filter(Boolean);
}

async function fetchIndexes(env) {
    if (indexCache && Date.now() - indexCacheAt <= 10 * 60 * 1000) return indexCache;
    const loaded = [];
    for (const indexPath of INDEX_PATHS) {
        const index = await fetchObject(env, indexPath);
        if (index && typeof index === 'object' && !Array.isArray(index)) {
            loaded.push({ indexPath, index });
        }
    }
    indexCache = loaded;
    indexCacheAt = Date.now();
    return indexCache;
}

function resolveTopicHit(indexes, topic) {
    const candidates = topicCandidates(topic);
    for (const candidate of candidates) {
        for (const item of indexes) {
            if (item.index[candidate]) {
                return {
                    topic: candidate,
                    requestedTopic: String(topic || '').trim(),
                    matchType: candidate === topic ? 'exact' : 'alias',
                    pack: item.index[candidate],
                    indexPath: item.indexPath
                };
            }
        }
    }
    for (const candidate of candidates) {
        for (const item of indexes) {
            const keys = Object.keys(item.index);
            const key = keys.find((k) => k.indexOf(candidate) >= 0 || candidate.indexOf(k) >= 0);
            if (key) {
                return {
                    topic: key,
                    requestedTopic: String(topic || '').trim(),
                    matchType: 'fuzzy',
                    pack: item.index[key],
                    indexPath: item.indexPath
                };
            }
        }
    }
    return null;
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

    const limited = rateLimit(clientRateKey(req, 'mini:qbank-topic'), 120);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: '请求过于频繁，请稍后再试。' }, 429);

    let body;
    try {
        body = await readJson(req, 16 * 1024);
    } catch (error) {
        return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
    }
    const topic = String(body.topic || '').trim().slice(0, 24);
    const limit = Math.max(4, Math.min(16, Number(body.limit || 8)));
    if (!topic) return json({ ok: false, error: 'missing_topic' }, 400);

    const env = (typeof process !== 'undefined' && process.env) || {};
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return json({ ok: true, fallback: true, fallback_source: 'qbank_storage_not_configured', deck: [] });
    }

    try {
        const indexes = await fetchIndexes(env);
        if (!indexes.length) {
            return json({ ok: true, fallback: true, fallback_source: 'qbank_index_unavailable', deck: [] });
        }
        const hit = resolveTopicHit(indexes, topic);
        if (!hit) {
            return json({ ok: true, fallback: true, fallback_source: 'topic_not_in_qbank', deck: [] });
        }
        const rows = await fetchObject(env, hit.pack.key);
        if (!Array.isArray(rows) || !rows.length) {
            return json({ ok: true, fallback: true, fallback_source: 'qbank_pack_unavailable', deck: [] });
        }
        const usable = rows.filter((r) => r && r.question && String(r.question).length <= 90 && r.equation);
        const deck = pickRows(usable.length >= limit ? usable : rows, limit).map((row) => {
            const step = firstStepFromEquation(row.equation);
            const leaked = step.includes(String(row.answer));
            return {
                q: `${String(row.question).replace(/\s+/g, ' ').trim()} 第一步先做什么？`,
                a: leaked ? '先把已知条件圈出来' : step,
                hint: '先说要求什么，再找第一步',
                source_topic: hit.topic
            };
        });
        return json({
            ok: true,
            fallback: false,
            requested_topic: hit.requestedTopic,
            topic: hit.topic,
            match_type: hit.matchType,
            deck,
            source: 'qbank_curated_v1'
        });
    } catch (error) {
        return json({ ok: true, fallback: true, fallback_source: 'qbank_fetch_error', deck: [] });
    }
}
