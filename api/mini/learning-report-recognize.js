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

const SUBJECTS = [
    { key: 'chinese', label: '语文', aliases: ['语文', '作文', '阅读'] },
    { key: 'math', label: '数学', aliases: ['数学', '应用题', '列式'] },
    { key: 'english', label: '英语', aliases: ['英语', '阅读题', '单词'] },
    { key: 'physics', label: '物理', aliases: ['物理'] },
    { key: 'chemistry', label: '化学', aliases: ['化学'] },
    { key: 'biology', label: '生物', aliases: ['生物'] },
    { key: 'history', label: '历史', aliases: ['历史'] },
    { key: 'geography', label: '地理', aliases: ['地理'] },
    { key: 'politics', label: '政治', aliases: ['政治', '道法'] }
];

function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
}

function parseScoreText(text) {
    const parsedScores = {};
    const lines = String(text || '').split(/\r?\n|；|;|。/).map((line) => clean(line, 260)).filter(Boolean);
    let totalScore = null;
    let classRank = null;
    let studentName = '';
    let note = '';

    lines.forEach((line) => {
        const nameMatch = line.match(/(?:姓名|学生)[:：\s]*([\u4e00-\u9fa5A-Za-z]{2,12})/);
        if (nameMatch && !studentName) studentName = nameMatch[1];
        if (/备注|说明|仅可见/.test(line)) note = note || line;
        const totalMatch = line.match(/(?:总分|总成绩|合计)(?!排名|名次)[^0-9-]*(-?\d+(?:\.\d+)?)/);
        if (totalMatch) totalScore = Number(totalMatch[1]);
        const rankMatch = line.match(/(?:总排名|班级排名|班名|排名|名次)[^0-9-]*(-?\d+)/);
        if (rankMatch) classRank = Number(rankMatch[1]);

        SUBJECTS.forEach((subject) => {
            if (!subject.aliases.some((alias) => line.includes(alias))) return;
            const pattern = subject.aliases.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            const scoreMatch = line.match(new RegExp(`(?:${pattern})[^0-9-]*(?:分数|成绩|得分)?[^0-9-]*(-?\\d+(?:\\.\\d+)?)`));
            const score = scoreMatch ? Number(scoreMatch[1]) : null;
            if (score === null || score < 0 || score > 200) return;
            const subjectRankMatch = line.match(/(?:班名|班级排名|排名|名次)[^0-9-]*(-?\d+)/);
            parsedScores[subject.label] = {
                subject: subject.label,
                key: subject.key,
                score,
                rank: subjectRankMatch ? Number(subjectRankMatch[1]) : undefined,
                confidence: /分数|成绩|得分|排名|名次|班名/.test(line) ? 0.9 : 0.72,
                status: '待家长确认',
                evidence: line.slice(0, 80)
            };
        });
    });

    if (totalScore === null) {
        const sum = Object.keys(parsedScores).reduce((acc, key) => acc + Number(parsedScores[key].score || 0), 0);
        totalScore = sum > 0 ? Math.round(sum * 10) / 10 : null;
    }

    const missingFields = [
        studentName ? '' : '学生姓名',
        Object.keys(parsedScores).length ? '' : '学科分数',
        classRank ? '' : '总排名/班级排名'
    ].filter(Boolean);

    return {
        studentName,
        parsedScores,
        parsedRanks: {
            totalScore,
            totalRank: classRank,
            classRank,
            note
        },
        missingFields
    };
}

function sourceTypeFrom(text, explicit) {
    const type = clean(explicit || '', 40);
    if (type) return type;
    if (/错题|错因|不会|列式|卡住|题目/.test(text)) return 'wrong_question';
    if (/测评|画像|倾向|风格|能力|问卷/.test(text)) return 'third_party_assessment';
    if (/总分|排名|语文|数学|英语|物理|化学|生物/.test(text)) return 'score_sheet';
    return 'mixed';
}

function recognitionServiceReady(env = {}) {
    return Boolean(env.LEARNING_REPORT_RECOGNITION_URL || env.OCR_RECOGNITION_URL);
}

function recognitionServiceUrl(env = {}) {
    return clean(env.LEARNING_REPORT_RECOGNITION_URL || env.OCR_RECOGNITION_URL || '', 500);
}

function recognitionServiceKey(env = {}) {
    return clean(env.LEARNING_REPORT_RECOGNITION_KEY || env.OCR_RECOGNITION_KEY || '', 500);
}

async function callRecognitionProvider(body = {}, env = {}) {
    const url = recognitionServiceUrl(env);
    if (!url) return null;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
    try {
        const key = recognitionServiceKey(env);
        const response = await fetch(url, {
            method: 'POST',
            headers: Object.assign({
                'content-type': 'application/json'
            }, key ? { authorization: `Bearer ${key}` } : {}),
            body: JSON.stringify({
                sourceType: clean(body.sourceType || '', 40),
                text: clean(body.text || body.sourceText || body.recognizedText || '', 5000),
                fileMeta: body.fileMeta && typeof body.fileMeta === 'object' ? body.fileMeta : {},
                confirmFirst: true
            }),
            signal: controller ? controller.signal : undefined
        });
        if (!response.ok) {
            return {
                provider: 'configured_recognition_service',
                error: `provider_status_${response.status}`,
                confidence: 0.36
            };
        }
        const data = await response.json();
        return Object.assign({}, data, {
            provider: clean(data.provider || 'configured_recognition_service', 60)
        });
    } catch (error) {
        return {
            provider: 'configured_recognition_service',
            error: error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_unavailable',
            confidence: 0.34
        };
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

function buildDraft(body = {}, options = {}) {
    const text = clean(body.text || body.sourceText || body.recognizedText || '', 5000);
    const serviceReady = Boolean(options.serviceReady);
    const provider = serviceReady && body.providerResult && typeof body.providerResult === 'object' ? body.providerResult : {};
    const providerText = clean(provider.recognizedText || provider.text || '', 5000);
    const recognizedText = text || providerText;
    const parsed = parseScoreText(recognizedText);
    const providerScores = provider.parsedScores && typeof provider.parsedScores === 'object' ? provider.parsedScores : {};
    const parsedScores = Object.assign({}, parsed.parsedScores, providerScores);
    const confidence = clamp(provider.confidence || (Object.keys(parsedScores).length ? 0.72 : 0.42), 0.2, 0.96, 0.42);
    const sourceType = sourceTypeFrom(recognizedText, body.sourceType);
    const missingFields = Array.from(new Set(parsed.missingFields.concat(Object.keys(parsedScores).length ? [] : ['可确认的学科分数'])));
    return {
        ok: Boolean(recognizedText || Object.keys(parsedScores).length),
        mode: provider.provider ? 'external_api' : recognizedText ? 'local_rules' : 'unavailable',
        service_ready: serviceReady,
        persisted: false,
        service_contract: {
            mode: serviceReady ? 'external_recognition_draft' : 'local_rules_draft',
            persisted: false,
            confirmation_required: true,
            evidence_required: ['recognized_text', 'parsed_scores', 'parent_confirmation']
        },
        action_required: serviceReady ? '' : 'recognition_service_configuration',
        sourceType,
        recognizedText,
        parsedScores,
        parsedRanks: Object.assign({}, parsed.parsedRanks, provider.parsedRanks || {}),
        assessmentSignals: provider.assessmentSignals || {},
        confidence,
        requiresConfirmation: true,
        confirmPrompts: [
            missingFields.length ? `请确认或补充：${missingFields.slice(0, 3).join('、')}` : '请确认分数、排名和孩子当前卡点是否准确。',
            sourceType === 'third_party_assessment' ? '第三方资料只作为能力倾向参考，不作为确定结论。' : ''
        ].filter(Boolean),
        missingFields,
        evidence: [
            Object.keys(parsedScores).length ? `已整理 ${Object.keys(parsedScores).slice(0, 4).join('、')} 等字段` : '',
            parsed.parsedRanks.totalScore !== null && parsed.parsedRanks.totalScore !== undefined ? `总分 ${parsed.parsedRanks.totalScore}` : '',
            provider.provider ? `外部整理来源：${clean(provider.provider, 40)}` : '',
            provider.error ? `外部整理状态：${clean(provider.error, 60)}` : ''
        ].filter(Boolean),
        updatedAt: new Date().toISOString()
    };
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({ ok: true });
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const session = await verifySession(req.headers.get('x-mini-session') || '', sessionSecret(env));
    if (!session.ok && session.mode !== 'missing') return json({ ok: false, error: 'bad_session' }, 401);

    const rate = rateLimit(clientRateKey(req, 'learning-report-recognize'), 80);
    if (!rate.ok) return json({ ok: false, error: 'rate_limited' }, 429);

    try {
        const body = await readJson(req, 32 * 1024);
        const serviceReady = recognitionServiceReady(env);
        const providerResult = serviceReady ? await callRecognitionProvider(body, env) : null;
        return json(buildDraft(Object.assign({}, body, providerResult ? { providerResult } : {}), { serviceReady }));
    } catch (error) {
        return json({ ok: false, error: error.message || 'bad_request' }, error.status || 400);
    }
}
