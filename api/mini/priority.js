// 原点智学 · 小程序学习优先级服务端兜底
// POST /api/mini/priority { score,totalScore,examText,homeworkText,minutes,grade,subject }
import {
    clean,
    clamp,
    clientIp,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';

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
    concept: ['概念', '定义', '性质', '公式', '原理', '为什么', '理解'],
    calculation: ['计算', '运算', '化简', '移项', '去括号', '分数', '小数', '符号'],
    reading: ['审题', '题意', '条件', '单位', '问什么', '已知', '未知', '关键字'],
    transfer: ['应用', '综合', '变式', '模型', '函数', '几何', '行程', '工程'],
    expression: ['过程', '步骤', '说明', '证明', '表达', '讲清楚', '复盘'],
    load: ['作业', '很多', '来不及', '熬夜', '疲惫', '效率', '时间']
};

function hits(text, key) {
    return (KEYWORDS[key] || []).reduce((sum, word) => sum + (String(text || '').includes(word) ? 1 : 0), 0);
}

function evidence(key, score) {
    const low = score < 55;
    const map = {
        concept: low ? '概念没有稳定落到题目条件里。' : '概念能用，但遇到变式会犹豫。',
        calculation: low ? '符号、移项、分数运算容易丢分。' : '计算基本稳定，需要减少低级失误。',
        reading: low ? '容易漏条件，或误读题目到底在问什么。' : '能抓主要条件，复杂题还要慢一点读。',
        transfer: low ? '换一种题型后，不知道先抓哪条线索。' : '常规迁移可做，综合题还需要拆步骤。',
        expression: low ? '会做不等于能讲清楚，复盘证据不足。' : '能说出步骤，继续训练为什么。',
        load: low ? '作业量和精力不匹配，需要先做最有价值的部分。' : '作业节奏基本可控。'
    };
    return map[key] || '需要继续观察。';
}

function splitHomework(text) {
    const lines = String(text || '')
        .split(/\n|；|;|。/)
        .map((item) => clean(item, 180))
        .filter(Boolean);

    return lines.length ? lines.slice(0, 24) : [
        '数学：方程基础题 8 道',
        '数学：应用题 4 道，写完整过程',
        '整理今天错题并讲出错因',
        '英语：单词抄写 3 遍'
    ];
}

function reasonForScore(score) {
    if (score >= 70) return '命中当前弱点或课堂核心，今晚优先做。';
    if (score >= 45) return '有帮助，但可以按时间和精力取舍。';
    return '低收益或机械重复，跳过是保护精力。';
}

function classifyHomework(text, weakPoints, minutes) {
    const availableMinutes = clamp(minutes || 35, 10, 120, 35);
    const lines = splitHomework(text);
    const weakText = (weakPoints || []).map((item) => item.name || '').join(' ');
    const baseMinutes = Math.max(5, Math.round(availableMinutes / Math.max(4, lines.length)));
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
            score: Math.round(clamp(score, 0, 100, 30)),
            minutes: baseMinutes,
            reason: reasonForScore(score)
        };
    }).sort((a, b) => b.score - a.score);

    const total = items.length;
    const mustCount = Math.max(1, Math.round(total * 0.48));
    const skipCount = Math.max(1, Math.round(total * 0.24));
    return {
        minutes_available: availableMinutes,
        must_do: items.slice(0, mustCount),
        flexible: items.slice(mustCount, total - skipCount),
        can_skip: items.slice(total - skipCount),
        rule: '必须做约 40-50%，可以跳过约 20-30%，剩余按精力灵活选择。',
        generated_at: new Date().toISOString()
    };
}

async function readRequest(req) {
    try {
        return await readJson(req, 24 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST' }, 405);

    const ip = clientIp(req);
    const limited = rateLimit(`mini:priority:${ip}`, 120);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: '请求过于频繁，请稍后再试' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) {
        return json({
            ok: false,
            error: body.__error.message === 'payload_too_large' ? 'payload_too_large' : 'bad_json',
            message: body.__error.message === 'payload_too_large' ? '请求体过大' : '请求体不是合法 JSON'
        }, body.__error.status || 400);
    }

    const total = clamp(body.totalScore || 100, 1, 1000, 100);
    const score = clamp(body.score == null ? 70 : body.score, 0, total, 70);
    const base = Math.round((score / total) * 100);
    const examText = clean(body.examText || '', 3000);
    const homeworkText = clean(body.homeworkText || '', 5000);
    const text = [examText, homeworkText].join(' ');

    const axes = AXES.map((axis) => {
        const adjusted = Math.round(clamp(base - hits(text, axis.key) * 8 - (axis.key === 'load' ? 10 : 0), 18, 94, base));
        return {
            key: axis.key,
            name: axis.name,
            score: adjusted,
            evidence: evidence(axis.key, adjusted)
        };
    });

    const weak_points = axes
        .slice()
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map((axis) => ({
            key: axis.key,
            name: axis.name,
            score: axis.score,
            reason: axis.evidence
        }));

    return json({
        ok: true,
        source: 'server-priority',
        stage: clean(body.stage || '小学高年级到初中衔接', 40),
        grade: clean(body.grade || '五年级', 20),
        subject: clean(body.subject || '数学', 20),
        textbook_version: clean(body.version || '人教版 MVP', 40),
        score,
        total_score: total,
        axes,
        weak_points,
        homework_plan: classifyHomework(homeworkText, weak_points, body.minutes || 35),
        engine_version: 'mini-priority-v1.1',
        updated_at: new Date().toISOString()
    });
}
