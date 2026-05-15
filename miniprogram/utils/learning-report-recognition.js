const learningReport = require('./learning-report');

const CHINESE_SUBJECTS = [
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

function safeText(value, max = 5000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function sourceText(value, max = 5000) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function clamp(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function confidenceLabel(value) {
  if (learningReport.confidenceLabel) return learningReport.confidenceLabel(value);
  const score = clamp(value, 0, 1, 0);
  if (score >= 0.78) return '高';
  if (score >= 0.55) return '中';
  return '低';
}

function parseChineseScoreText(text = '') {
  const lines = String(text || '').split(/\r?\n|；|;|。/).map((line) => safeText(line, 260)).filter(Boolean);
  const parsedScores = {};
  let totalScore = null;
  let totalRank = null;
  let studentName = '';
  let note = '';

  lines.forEach((line) => {
    const nameMatch = line.match(/(?:姓名|学生)[:：\s]*([\u4e00-\u9fa5A-Za-z]{2,12})/);
    if (nameMatch && !studentName) studentName = nameMatch[1];
    if (/备注|说明|仅可见/.test(line)) note = note || line;
    const totalMatch = line.match(/(?:总分|总成绩|合计)(?!排名|名次)[^0-9-]*(-?\d+(?:\.\d+)?)/);
    if (totalMatch) totalScore = Number(totalMatch[1]);
    const rankMatch = line.match(/(?:总排名|班级排名|班名|排名|名次)[^0-9-]*(-?\d+)/);
    if (rankMatch) totalRank = Number(rankMatch[1]);

    CHINESE_SUBJECTS.forEach((subject) => {
      if (!subject.aliases.some((alias) => line.indexOf(alias) >= 0)) return;
      const pattern = subject.aliases.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const match = line.match(new RegExp(`(?:${pattern})[^0-9-]*(?:分数|成绩|得分)?[^0-9-]*(-?\\d+(?:\\.\\d+)?)`));
      const score = match ? Number(match[1]) : null;
      if (score === null || score < 0 || score > 200) return;
      const subjectRank = line.match(/(?:班名|班级排名|排名|名次)[^0-9-]*(-?\d+)/);
      const confidence = /分数|成绩|得分|排名|名次|班名/.test(line) ? 0.9 : 0.74;
      parsedScores[subject.label] = {
        subject: subject.label,
        key: subject.key,
        score,
        rank: subjectRank ? Number(subjectRank[1]) : undefined,
        confidence,
        confidenceLabel: confidenceLabel(confidence),
        status: '待家长确认',
        evidence: line.slice(0, 80)
      };
    });
  });

  if (totalScore === null) {
    const total = Object.keys(parsedScores).reduce((sum, key) => sum + Number(parsedScores[key].score || 0), 0);
    totalScore = total > 0 ? Math.round(total * 10) / 10 : null;
  }

  return {
    parsedScores,
    parsedRanks: {
      totalScore,
      totalRank,
      classRank: totalRank,
      note
    },
    missingFields: [
      studentName ? '' : '学生姓名',
      Object.keys(parsedScores).length ? '' : '学科分数',
      totalRank ? '' : '总排名/班级排名'
    ].filter(Boolean)
  };
}

function collectEvidence(parsed, text, providerResult) {
  const evidence = [];
  const scoreSubjects = Object.keys((parsed && parsed.parsedScores) || {});
  if (scoreSubjects.length) evidence.push(`已整理 ${scoreSubjects.slice(0, 4).join('、')} 等分数字段`);
  if (parsed && parsed.parsedRanks && parsed.parsedRanks.totalScore !== null && parsed.parsedRanks.totalScore !== undefined) {
    evidence.push(`总分 ${parsed.parsedRanks.totalScore}`);
  }
  if (providerResult && providerResult.provider) evidence.push(`外部整理来源：${providerResult.provider}`);
  if (text) evidence.push(`原始资料 ${Math.min(text.length, 120)} 字以内用于草稿`);
  return evidence.slice(0, 5);
}

function normalizeParsedScores(value) {
  const scores = {};
  Object.keys(value || {}).forEach((key) => {
    const item = value[key] || {};
    const subject = item.subject || key;
    const score = Number(item.score);
    if (!subject || !Number.isFinite(score)) return;
    scores[subject] = Object.assign({
      subject,
      score,
      confidence: clamp(item.confidence === undefined ? 0.78 : item.confidence, 0.2, 0.98, 0.78),
      confidenceLabel: confidenceLabel(item.confidence === undefined ? 0.78 : item.confidence),
      status: item.status || '待家长确认',
      evidence: safeText(item.evidence || `${subject} ${score}`, 80)
    }, item);
  });
  return scores;
}

function normalizeProviderResult(providerResult = {}) {
  if (!providerResult || typeof providerResult !== 'object') return {};
  return {
    provider: safeText(providerResult.provider, 40),
    recognizedText: sourceText(providerResult.recognizedText || providerResult.text || providerResult.rawText, 5000),
    parsedScores: normalizeParsedScores(providerResult.parsedScores || providerResult.scores),
    parsedRanks: Object.assign({}, providerResult.parsedRanks || providerResult.ranks || {}),
    assessmentSignals: Object.assign({}, providerResult.assessmentSignals || {}),
    confidence: clamp(providerResult.confidence === undefined ? 0.66 : providerResult.confidence, 0.2, 0.98, 0.66)
  };
}

function inferSourceType(input = {}, text = '') {
  const explicit = safeText(input.sourceType, 40);
  if (explicit) return explicit;
  if (/错题|错因|不会|列式|题目|卡住/.test(text)) return 'wrong_question';
  if (/测评|画像|倾向|风格|能力|问卷/.test(text)) return 'third_party_assessment';
  if (/总分|排名|班名|语文|数学|英语|物理|化学|生物/.test(text)) return 'score_sheet';
  return 'mixed';
}

function buildConfirmPrompts(parsed, confidence, sourceType) {
  const prompts = [];
  const missing = (parsed && parsed.missingFields) || [];
  if (missing.length) prompts.push(`请确认或补充：${missing.slice(0, 3).join('、')}`);
  if (confidence < 0.7) prompts.push('这份资料只是整理草稿，请家长确认后再生成结论。');
  if (sourceType === 'third_party_assessment') prompts.push('第三方资料只作为能力倾向参考，不作为确定结论。');
  if (!prompts.length) prompts.push('请确认分数、排名和孩子当前卡点是否准确。');
  return prompts;
}

function normalizeRecognitionDraft(input = {}) {
  const provider = normalizeProviderResult(input.providerResult || input.externalResult || {});
  const text = sourceText(input.recognizedText || input.text || input.sourceText || provider.recognizedText, 5000);
  const parsed = learningReport.parseScoreTableText ? learningReport.parseScoreTableText(text) : {
    parsedScores: {},
    parsedRanks: {},
    requiresConfirmation: true,
    missingFields: ['成绩字段']
  };
  const plainParsed = parseChineseScoreText(text);
  const parsedScores = Object.assign({}, parsed.parsedScores || {}, plainParsed.parsedScores || {}, provider.parsedScores || {});
  const parsedRanks = Object.assign({}, parsed.parsedRanks || {}, plainParsed.parsedRanks || {}, provider.parsedRanks || {});
  const scoreCount = Object.keys(parsedScores).length;
  const providerConfidence = provider.confidence || 0;
  const localConfidence = scoreCount ? 0.72 : (text ? 0.46 : 0.25);
  const confidence = clamp(Math.max(localConfidence, providerConfidence), 0.2, 0.98, 0.35);
  const sourceType = inferSourceType(input, text);
  const mode = provider.provider ? 'external_api' : text ? 'manual_text' : 'unavailable';
  const missingFields = Array.from(new Set((parsed.missingFields || []).concat(plainParsed.missingFields || []).concat(
    scoreCount ? [] : ['可确认的学科分数'],
    text ? [] : ['可整理的资料文字']
  )));
  const requiresConfirmation = true;

  return {
    ok: Boolean(text || scoreCount || provider.provider),
    mode,
    sourceType,
    recognizedText: text,
    parsedScores,
    parsedRanks,
    assessmentSignals: provider.assessmentSignals || {},
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    requiresConfirmation,
    confirmPrompts: buildConfirmPrompts({ missingFields }, confidence, sourceType),
    missingFields,
    evidence: collectEvidence({ parsedScores, parsedRanks }, text, provider),
    fileMeta: Object.assign({}, input.fileMeta || {}),
    updatedAt: new Date().toISOString()
  };
}

function buildRecognitionFallback(input = {}) {
  return normalizeRecognitionDraft(Object.assign({}, input, {
    providerResult: null
  }));
}

function mergeRecognitionIntoReportInput(reportInput = {}, recognitionDraft = {}) {
  const draft = recognitionDraft || {};
  const recognizedText = sourceText(draft.recognizedText || reportInput.sourceText, 5000);
  const existingSources = asArray(reportInput.reportSources);
  const recognitionSource = recognizedText ? [{
    type: draft.sourceType || 'mixed',
    label: draft.mode === 'external_api' ? '资料整理草稿' : '家长确认资料',
    text: recognizedText,
    confidence: clamp(draft.confidence === undefined ? 0.55 : draft.confidence, 0.2, 0.98, 0.55),
    status: draft.requiresConfirmation ? '待家长确认' : '已确认',
    evidence: asArray(draft.evidence).slice(0, 4)
  }] : [];

  return Object.assign({}, reportInput, {
    sourceText: recognizedText,
    reportSources: recognitionSource.concat(existingSources).slice(0, 20),
    parsedScores: Object.assign({}, reportInput.parsedScores || {}, draft.parsedScores || {}),
    parsedRanks: Object.assign({}, reportInput.parsedRanks || {}, draft.parsedRanks || {}),
    recognitionDraft: draft
  });
}

module.exports = {
  normalizeRecognitionDraft,
  buildRecognitionFallback,
  mergeRecognitionIntoReportInput
};
