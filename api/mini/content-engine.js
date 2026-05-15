import {
    clean,
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';

export const config = { runtime: 'edge' };

const ENGINE_VERSION = 'mini-content-engine-v1.0';

function normalizeText(text, max = 72) {
    const value = clean(text, max * 2).replace(/\s+/g, ' ').trim();
    return value.length > max ? `${value.slice(0, max)}...` : value;
}

function stableId(prefix, parts) {
    return `${prefix}_${parts.filter(Boolean).join('_')}`.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5:-]/g, '_').slice(0, 96);
}

function splitInput(text) {
    return String(text || '')
        .split(/\r?\n|；|;|。/)
        .map((line) => clean(line, 260))
        .filter(Boolean)
        .slice(0, 18);
}

function scoreQuality(item) {
    let score = 48;
    if (item.question && item.question.length >= 10) score += 14;
    if (item.answer && item.answer.length >= 8) score += 14;
    if (item.context) score += 6;
    if (item.weakPoint) score += 8;
    if (item.cardType === 'step' || item.cardType === 'trap') score += 8;
    return Math.max(0, Math.min(100, score));
}

function firstStep(text) {
    const parts = String(text || '').split(/先|然后|再|最后|第一|第二|第三|，|,|、/).map((item) => item.trim()).filter(Boolean);
    const hit = parts.find((item) => /条件|已知|单位|关系|题意|公式|错因|检查/.test(item));
    return hit ? `先${hit}` : '先说清题目条件、卡点和下一步检查什么。';
}

function detectTrap(text) {
    const value = String(text || '');
    if (/单位|厘米|米|分钟|小时/.test(value)) return '最容易错在单位没有统一。';
    if (/符号|正负|移项|括号/.test(value)) return '最容易错在符号、括号或移项。';
    if (/条件|题意|已知|未知/.test(value)) return '最容易错在漏读条件或没看清题目问什么。';
    if (/公式|定义|概念/.test(value)) return '最容易错在套公式前没有确认概念条件。';
    return '最容易错在跳过关键检查步骤。';
}

function clozeKeyword(text) {
    const candidates = String(text || '').match(/[\u4e00-\u9fa5A-Za-z0-9]{2,12}/g) || [];
    return candidates
        .filter((word) => !['因为', '所以', '然后', '这个', '一个', '可以'].includes(word))
        .sort((a, b) => b.length - a.length)[0] || '';
}

function localCards(text, options = {}) {
    const subject = clean(options.subject || '', 24);
    const weakPoint = clean(options.weakPoint || '', 40);
    const calibrationKey = clean(options.calibrationKey || '', 80);
    const cards = [];
    splitInput(text).forEach((line, index) => {
        const question = line.includes(':') || line.includes('：')
            ? line.split(/:|：/)[0]
            : line;
        const answer = line.includes(':') || line.includes('：')
            ? line.split(/:|：/).slice(1).join(':')
            : line;
        [
            {
                cardType: 'concept',
                question: `这条内容真正要掌握什么：${normalizeText(question, 36)}`,
                answer: normalizeText(answer || line, 96),
                reason: '概念理解'
            },
            {
                cardType: 'step',
                question: `遇到这类题第一步做什么：${normalizeText(question, 34)}`,
                answer: firstStep(line),
                reason: '步骤巩固'
            },
            {
                cardType: 'trap',
                question: `这类内容最容易错在哪里：${normalizeText(question, 34)}`,
                answer: detectTrap(line),
                reason: '易错提醒'
            }
        ].forEach((item) => {
            const card = Object.assign({
                id: stableId('ce', [item.cardType, subject || 'general', index, item.question.slice(0, 16)]),
                subject,
                weakPoint,
                calibrationKey,
                context: line,
                engine: ENGINE_VERSION,
                engineMode: 'local_rules'
            }, item);
            card.quality = scoreQuality(card);
            cards.push(card);
        });
        const keyword = clozeKeyword(answer || line);
        if (keyword) {
            const card = {
                id: stableId('ce', ['cloze', subject || 'general', index, keyword]),
                cardType: 'cloze',
                question: normalizeText((answer || line).replace(keyword, '____'), 56),
                answer: keyword,
                subject,
                weakPoint,
                calibrationKey,
                context: line,
                reason: '关键词填空',
                engine: ENGINE_VERSION,
                engineMode: 'local_rules'
            };
            card.quality = scoreQuality(card);
            cards.push(card);
        }
    });
    const seen = new Set();
    return cards.filter((card) => {
        const key = card.question;
        if (seen.has(key)) return false;
        seen.add(key);
        return card.quality >= 55;
    }).slice(0, 48);
}

function buildQualityGate(cards = [], coveredTypes = []) {
    const hasQuestion = cards.filter((card) => String(card.question || '').length >= 10).length;
    const hasAnswer = cards.filter((card) => String(card.answer || '').length >= 8).length;
    const hasTransfer = cards.filter((card) => /transfer|变式|迁移|similar|changed/i.test(`${card.question || ''} ${card.answer || ''}`)).length;
    const hasWrongCause = cards.filter((card) => /wrong|cause|错因|误区|trap|careless/i.test(`${card.cardType || ''} ${card.question || ''} ${card.answer || ''}`)).length;
    const checks = [
        { id: 'question', label: '回忆题明确', ready: hasQuestion >= 2, value: hasQuestion },
        { id: 'answer', label: '核对内容可用', ready: hasAnswer >= 2, value: hasAnswer },
        { id: 'wrong_cause', label: '看得到错因', ready: hasWrongCause >= 1, value: hasWrongCause },
        { id: 'transfer', label: '有迁移检查', ready: hasTransfer >= 1, value: hasTransfer },
        { id: 'coverage', label: '核心类型覆盖', ready: coveredTypes.length >= 2, value: coveredTypes.length }
    ];
    const ready = checks.filter((item) => item.ready).length;
    return {
        title: '材料导入条件',
        score: Math.min(100, Math.round((ready / checks.length) * 100)),
        label: ready >= 4
            ? '这套材料可以导入复习，并生成本机学习记录。'
            : '材料还不够具体，先补上错步、对比例题和迁移检查。',
        checks,
        next: ready >= 4
            ? '导入复习后，完成一次小测并生成我的复盘摘要。'
            : '补上具体错步、一个对比例题和一道迁移题。'
    };
}

function buildStudyPack(cards = [], text = '', options = {}) {
    const lines = splitInput(text);
    const first = lines[0] || 'material';
    const second = lines[1] || first;
    const cardCount = cards.length;
    const quizCount = Math.max(3, Math.min(8, cardCount + 2));
    return {
        title: '知识关卡输出',
        summary: `${options.inputType || 'material'} -> ${Math.max(1, cardCount)} 张卡 -> ${quizCount} 道小测 -> 7 天复习 -> 我的复盘。`,
        outputs: [
            { id: 'knowledge', title: '知识卡', value: Math.max(1, cardCount), body: `提炼核心方法：${normalizeText(first, 42)}` },
            { id: 'wrong_cause', title: '错因卡', value: Math.max(1, Math.ceil(cardCount / 2)), body: `追问具体错步：${normalizeText(second, 38)}` },
            { id: 'quiz', title: '小测验', value: quizCount, body: '混合回忆、填空、迁移和一次闭卷解释。' },
            { id: 'review', title: '复习计划', value: '7天', body: '今天、明天、第 3 天、第 5 天和第 7 天，小负担回访。' },
            { id: 'reflection', title: '我的复盘', value: Math.round(cards.reduce((sum, card) => sum + Number(card.quality || 0), 0) / Math.max(1, cards.length)), body: '记录今晚学什么、避开什么错、什么算掌握证据。' }
        ],
        reflectionLine: '我的复盘：讲清一个方法，说出一个错因，完成一次小测，并进入间隔复习。'
    };
}

function aiPrompt(text, options = {}) {
    return [
        {
            role: 'system',
            content: '你是K12学习卡片内容引擎。只输出JSON，结构为{"cards":[{"cardType":"concept|step|trap|cloze","question":"","answer":"","reason":"","context":""}]}。卡片必须帮助学生提分减负，不给作业代写答案。'
        },
        {
            role: 'user',
            content: JSON.stringify({
                subject: options.subject || '',
                weakPoint: options.weakPoint || '',
                calibrationKey: options.calibrationKey || '',
                text: clean(text, 4000)
            })
        }
    ];
}

async function remoteCards(text, options = {}) {
    const env = (typeof process !== 'undefined' && process.env) || {};
    const key = env.QWEN_KEY || env.DASHSCOPE_API_KEY || env.DEEPSEEK_KEY || env.DEEPSEEK_API_KEY || '';
    if (!key) return null;
    const qwen = env.QWEN_KEY || env.DASHSCOPE_API_KEY;
    const url = qwen
        ? 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
        : 'https://api.deepseek.com/v1/chat/completions';
    const model = qwen ? 'qwen-plus' : 'deepseek-chat';
    try {
        const upstream = await fetch(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${key}`
            },
            body: JSON.stringify({
                model,
                messages: aiPrompt(text, options),
                temperature: 0.1,
                max_tokens: 1600,
                response_format: qwen ? undefined : { type: 'json_object' }
            })
        });
        if (!upstream.ok) return null;
        const data = await upstream.json();
        const content = data.choices?.[0]?.message?.content || '';
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed.cards)) return null;
        return parsed.cards.slice(0, 48).map((item, index) => {
            const card = {
                id: stableId('ai_ce', [item.cardType || 'card', index, item.question || '']),
                cardType: ['concept', 'step', 'trap', 'cloze'].includes(item.cardType) ? item.cardType : 'concept',
                question: clean(item.question || '', 140),
                answer: clean(item.answer || '', 260),
                reason: clean(item.reason || 'AI生成卡', 80),
                context: clean(item.context || '', 260),
                subject: clean(options.subject || '', 24),
                weakPoint: clean(options.weakPoint || '', 40),
                calibrationKey: clean(options.calibrationKey || '', 80),
                engine: ENGINE_VERSION,
                engineMode: 'remote_ai'
            };
            card.quality = scoreQuality(card);
            return card;
        }).filter((card) => card.question && card.answer && card.quality >= 55);
    } catch (error) {
        return null;
    }
}

async function readRequest(req) {
    try {
        return await readJson(req, 32 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST 请求。' }, 405);

    const limited = rateLimit(clientRateKey(req, 'mini:content-engine'), 100);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: '请求过于频繁，请稍后再试。' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面。' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) {
        return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);
    }

    const text = clean(body.text || body.rawText || body.content || '', 6000);
    if (!text) return json({ ok: false, error: 'missing_text', message: '请先输入真实学习材料。' }, 400);

    const options = {
        subject: body.subject,
        weakPoint: body.weakPoint || body.weak_point,
        calibrationKey: body.calibrationKey || body.calibration_key
    };
    const ai = body.mode !== 'local' ? await remoteCards(text, options) : null;
    const cards = ai && ai.length ? ai : localCards(text, options);
    const coveredTypes = Array.from(new Set(cards.map((card) => card.cardType)));
    const qualityGate = buildQualityGate(cards, coveredTypes);
    const studyPack = buildStudyPack(cards, text, {
        inputType: body.inputType || body.type || 'material'
    });

    return json({
        ok: true,
        provider: ai && ai.length ? 'remote_ai_content_engine_v1' : 'rule_content_engine_v2',
        persisted: false,
        service_contract: {
            mode: ai && ai.length ? 'configured_model_with_local_quality_gate' : 'local_rules',
            evidence_required: ['text', 'subject_or_weak_point'],
            action_required: ai && ai.length ? '' : 'model_service_configuration'
        },
        cards,
        count: cards.length,
        requiredTypes: ['concept', 'step', 'trap', 'cloze'],
        coveredTypes,
        quality_gate: qualityGate,
        study_pack: studyPack,
        engine_version: ENGINE_VERSION,
        ai_notice: 'AI 辅助生成，供复习规划参考，不用于替代作业答案。'
    });
}
