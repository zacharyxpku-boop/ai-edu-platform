// 原点智学 · 小程序学习优先级服务端兜底
// POST /api/mini/priority { score,totalScore,examText,homeworkText,minutes,grade,subject }

export const config = { runtime: 'edge' };

const AXES = [
    { key: 'concept', name: '概念理解' },
    { key: 'calculation', name: '计算准确' },
    { key: 'reading', name: '审题建模' },
    { key: 'transfer', name: '迁移应用' },
    { key: 'expression', name: '表达复盘' },
    { key: 'load', name: '作业负荷' }
];

const KEYWORDS = {
    concept: ['概念', '定义', '性质', '公式', '原理'],
    calculation: ['计算', '移项', '符号', '分数', '小数'],
    reading: ['审题', '题意', '条件', '单位', '问什么'],
    transfer: ['应用', '综合', '变式', '模型', '函数'],
    expression: ['过程', '步骤', '说明', '表达', '复盘'],
    load: ['作业', '很多', '来不及', '熬夜', '效率']
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type'
        }
    });
}

function clamp(n, min, max) {
    const value = Number(n);
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
}

function hits(text, key) {
    return (KEYWORDS[key] || []).reduce((sum, word) => sum + (String(text || '').includes(word) ? 1 : 0), 0);
}

function splitHomework(text) {
    const lines = String(text || '').split(/\n|；|;|。/).map((item) => item.trim()).filter(Boolean);
    return lines.length ? lines.slice(0, 24) : ['数学基础题 8 道', '应用题 4 道', '整理今天错题', '英语单词抄写 3 遍'];
}

function classifyHomework(text, weakPoints, minutes) {
    const lines = splitHomework(text);
    const weakText = (weakPoints || []).map((item) => item.name).join(' ');
    const items = lines.map((line, index) => {
        let score = 30;
        if (/错题|订正|复盘|过程|讲/.test(line)) score += 28;
        if (/基础|例题|必做|课堂|老师/.test(line)) score += 18;
        if (/应用|综合|变式|方程|函数|几何|阅读/.test(line)) score += 16;
        if (/抄写|机械|摘抄|预习|拓展|选做/.test(line)) score -= 18;
        if (weakText && weakText.split(/\s+/).some((word) => word && line.includes(word.slice(0, 2)))) score += 16;
        score -= index * 1.5;
        return {
            id: `hw_${index + 1}`,
            text: line,
            score: Math.round(clamp(score, 0, 100)),
            minutes: Math.max(5, Math.round(clamp(minutes || 35, 10, 120) / Math.max(4, lines.length)))
        };
    }).sort((a, b) => b.score - a.score);
    const total = items.length;
    const mustCount = Math.max(1, Math.round(total * 0.48));
    const skipCount = Math.max(1, Math.round(total * 0.24));
    return {
        minutes_available: clamp(minutes || 35, 10, 120),
        must_do: items.slice(0, mustCount),
        flexible: items.slice(mustCount, total - skipCount),
        can_skip: items.slice(total - skipCount)
    };
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST' }, 405);
    let body = {};
    try { body = await req.json(); }
    catch (error) { return json({ ok: false, error: 'bad_json', message: '请求体不是合法 JSON' }, 400); }

    const total = Number(body.totalScore || 100) || 100;
    const base = Math.round((clamp(body.score == null ? 70 : body.score, 0, total) / total) * 100);
    const text = [body.examText || '', body.homeworkText || ''].join(' ');
    const axes = AXES.map((axis) => {
        const score = Math.round(clamp(base - hits(text, axis.key) * 8 - (axis.key === 'load' ? 10 : 0), 18, 94));
        return { key: axis.key, name: axis.name, score };
    });
    const weak_points = axes.slice().sort((a, b) => a.score - b.score).slice(0, 3).map((axis) => ({
        key: axis.key,
        name: axis.name,
        score: axis.score,
        reason: axis.score < 55 ? '当前最需要优先修复。' : '需要继续观察并专项练习。'
    }));
    return json({
        ok: true,
        grade: body.grade || '五年级',
        subject: body.subject || '数学',
        axes,
        weak_points,
        homework_plan: classifyHomework(body.homeworkText || '', weak_points, body.minutes || 35),
        engine_version: 'mini-priority-v1.0'
    });
}
