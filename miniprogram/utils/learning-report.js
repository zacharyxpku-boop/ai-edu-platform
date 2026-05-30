const SUBJECTS = [
  { key: 'chinese', label: '语文', aliases: ['语文', '作文', '阅读', '古文', '文言', '默写'] },
  { key: 'math', label: '数学', aliases: ['数学', '方程', '应用题', '列式', '几何', '函数', '代数'] },
  { key: 'english', label: '英语', aliases: ['英语', '单词', '语法', '听写', '完形'] },
  { key: 'physics', label: '物理', aliases: ['物理', '力学', '电路', '实验'] },
  { key: 'chemistry', label: '化学', aliases: ['化学', '方程式', '实验'] },
  { key: 'biology', label: '生物', aliases: ['生物', '生命', '遗传'] },
  { key: 'history', label: '历史', aliases: ['历史'] },
  { key: 'geography', label: '地理', aliases: ['地理'] },
  { key: 'politics', label: '政治', aliases: ['政治', '道法'] },
  { key: 'science', label: '科学', aliases: ['科学'] }
];

let personalizedReportTemplate = null;
try {
  personalizedReportTemplate = require('./personalized-report-template');
} catch (error) {
  personalizedReportTemplate = null;
}

const QUICK_ASSESSMENT_QUESTIONS = [
  {
    id: 'start_mode',
    prompt: '遇到新题时，孩子更常怎么开始？',
    options: [
      { id: 'circle', label: '先圈条件', weights: { visual: 2, structure: 2 } },
      { id: 'read', label: '先完整读一遍', weights: { reading: 2, auditory: 1 } },
      { id: 'write', label: '先写一步试试', weights: { kinesthetic: 2, structure: 1 } }
    ]
  },
  {
    id: 'condition_scan',
    prompt: '题目条件很多时，孩子最需要哪种支持？',
    options: [
      { id: 'mark', label: '标记关键词', weights: { visual: 2, structure: 1 } },
      { id: 'repeat', label: '听别人复述', weights: { auditory: 2 } },
      { id: 'split', label: '拆成小步骤', weights: { structure: 2, persistence: 1 } }
    ]
  },
  {
    id: 'mistake_repair',
    prompt: '错题订正时，孩子更容易接受哪种方式？',
    options: [
      { id: 'compare', label: '对比原题和错因', weights: { reading: 2, structure: 1 } },
      { id: 'talk', label: '先说哪里卡住', weights: { auditory: 2, emotion: 1 } },
      { id: 'redo', label: '直接做一小题', weights: { kinesthetic: 2 } }
    ]
  },
  {
    id: 'variant_transfer',
    prompt: '换一个条件后，孩子通常会怎样？',
    options: [
      { id: 'stable', label: '能说出变化点', weights: { structure: 2, persistence: 1 } },
      { id: 'hesitate', label: '需要一点提示', weights: { emotion: 1, auditory: 1 } },
      { id: 'restart', label: '容易重新卡住', weights: { structure: 1, focus: 1 } }
    ]
  },
  {
    id: 'memory_mode',
    prompt: '记新内容时，哪种方式更顺？',
    options: [
      { id: 'look', label: '看图表/颜色', weights: { visual: 2 } },
      { id: 'say', label: '听讲/复述', weights: { auditory: 2 } },
      { id: 'write', label: '边写边记', weights: { reading: 1, kinesthetic: 2 } }
    ]
  },
  {
    id: 'focus_span',
    prompt: '独立学习 15 分钟时，孩子状态通常如何？',
    options: [
      { id: 'steady', label: '基本能坐住', weights: { focus: 2, persistence: 1 } },
      { id: 'remind', label: '需要提醒', weights: { focus: 1, emotion: 1 } },
      { id: 'break', label: '容易停下来', weights: { focus: 1 } }
    ]
  },
  {
    id: 'homework_rhythm',
    prompt: '作业时间变长时，最容易发生什么？',
    options: [
      { id: 'slow', label: '速度变慢', weights: { focus: 1 } },
      { id: 'avoid', label: '想先放一放', weights: { emotion: 2 } },
      { id: 'rush', label: '开始赶步骤', weights: { structure: 1, focus: 1 } }
    ]
  },
  {
    id: 'parent_talk',
    prompt: '家长问学习时，孩子更容易回应哪句话？',
    options: [
      { id: 'first_step', label: '第一步先做什么', weights: { structure: 2 } },
      { id: 'where_stuck', label: '刚才卡在哪里', weights: { emotion: 1, auditory: 1 } },
      { id: 'what_help', label: '你需要哪种帮忙', weights: { emotion: 2 } }
    ]
  },
  {
    id: 'reading_load',
    prompt: '长题干或长段落出现时，孩子更像哪种状态？',
    options: [
      { id: 'mark', label: '能边读边标', weights: { visual: 2, reading: 1 } },
      { id: 'listen', label: '听别人读更清楚', weights: { auditory: 2 } },
      { id: 'split', label: '需要分段处理', weights: { structure: 2 } }
    ]
  },
  {
    id: 'review_habit',
    prompt: '第二天回看昨天的题时，孩子通常如何？',
    options: [
      { id: 'remember_step', label: '记得第一步', weights: { persistence: 2, structure: 1 } },
      { id: 'remember_context', label: '记得场景但不稳', weights: { reading: 1, emotion: 1 } },
      { id: 'need_restart', label: '需要重新开始', weights: { focus: 1, persistence: 1 } }
    ]
  },
  {
    id: 'exam_feeling',
    prompt: '考试前孩子更常见的反应是？',
    options: [
      { id: 'calm', label: '按步骤准备', weights: { persistence: 2 } },
      { id: 'worry', label: '担心发挥', weights: { emotion: 2 } },
      { id: 'avoid', label: '不太愿意谈', weights: { emotion: 2, focus: 1 } }
    ]
  },
  {
    id: 'favorite_task',
    prompt: '孩子更愿意先完成哪类任务？',
    options: [
      { id: 'logic', label: '有明确步骤', weights: { structure: 2 } },
      { id: 'expression', label: '可以表达想法', weights: { reading: 1, auditory: 1 } },
      { id: 'hands_on', label: '可以动手操作', weights: { kinesthetic: 2 } }
    ]
  },
  {
    id: 'support_preference',
    prompt: '孩子卡住时，哪种帮助最有效？',
    options: [
      { id: 'hint', label: '给一个提示', weights: { structure: 1, auditory: 1 } },
      { id: 'example', label: '看一个例子', weights: { visual: 1, reading: 1 } },
      { id: 'small_goal', label: '只定小目标', weights: { focus: 2, emotion: 1 } }
    ]
  },
  {
    id: 'self_strength',
    prompt: '孩子自认为更擅长什么？',
    options: [
      { id: 'think', label: '想清楚关系', weights: { structure: 2 } },
      { id: 'speak', label: '说出自己的想法', weights: { auditory: 2 } },
      { id: 'try', label: '试着做出来', weights: { kinesthetic: 2 } }
    ]
  },
  {
    id: 'next_goal',
    prompt: '接下来一周最值得先练什么？',
    options: [
      { id: 'first_step', label: '说清第一步', weights: { structure: 2 } },
      { id: 'focus', label: '坐住一小段', weights: { focus: 2 } },
      { id: 'review', label: '回看错题', weights: { persistence: 2 } }
    ]
  }
];

let openMaicInspiredPlanUtils = null;
try {
  openMaicInspiredPlanUtils = require('./openmaic-inspired-plan');
} catch (error) {
  openMaicInspiredPlanUtils = null;
}

let familyReportEngine = null;
try {
  familyReportEngine = require('./family-report-engine');
} catch (error) {
  familyReportEngine = null;
}

function nowIso(nowInput) {
  const date = nowInput instanceof Date ? nowInput : new Date(nowInput || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function safeText(value, fallback = '') {
  return String(value || '').replace(/\s+/g, ' ').trim() || fallback;
}

function clamp(number, min, max) {
  const value = Number(number);
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function confidenceLabel(value) {
  const score = clamp(value, 0, 1);
  if (score >= 0.78) return '高';
  if (score >= 0.55) return '中';
  return '低';
}

function subjectFromLine(line) {
  const text = String(line || '');
  return SUBJECTS.find((subject) => subject.aliases.some((alias) => text.indexOf(alias) >= 0));
}

function parseNumber(value) {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function firstNumberAfter(line, labelPattern) {
  const match = String(line || '').match(new RegExp(`(?:${labelPattern})[^0-9-]*(-?\\d+(?:\\.\\d+)?)`));
  return match ? Number(match[1]) : null;
}

function rankFromLine(line) {
  const value = String(line || '');
  const rank = firstNumberAfter(value, '班名|班级排名|班排|年级排名|总排名|排名|名次');
  return rank === null ? null : rank;
}

function makeScoreRecord(subject, score, rank, line, confidence) {
  const safeConfidence = clamp(confidence, 0.35, 0.98);
  return {
    subject: subject.label,
    key: subject.key,
    score,
    rank: rank === null ? undefined : rank,
    confidence: safeConfidence,
    confidenceLabel: confidenceLabel(safeConfidence),
    status: safeConfidence >= 0.68 ? '已识别' : '待确认',
    evidence: safeText(line).slice(0, 80)
  };
}

function parseScoreTableText(text = '') {
  const raw = String(text || '').replace(/[，,；;]/g, '\n');
  const lines = raw.split(/\r?\n|。/).map((line) => safeText(line)).filter(Boolean);
  const parsedScores = {};
  const namedRanks = [];
  let totalScore = null;
  let totalRank = null;
  let studentName = '';
  let note = '';

  lines.forEach((line, index) => {
    const nameMatch = line.match(/(?:姓名|学生)[:：\s]*([\u4e00-\u9fa5A-Za-z]{2,12})/);
    if (nameMatch && !studentName) studentName = nameMatch[1];

    if (/仅可见|备注|说明/.test(line)) note = note || line;

    if (/总分|总成绩|合计/.test(line)) {
      const scoreMatch = line.match(/(?:总分|总成绩|合计)(?!排名|名次)[^0-9-]*(-?\d+(?:\.\d+)?)/);
      const score = scoreMatch ? Number(scoreMatch[1]) : null;
      if (score !== null) totalScore = score;
      const rank = rankFromLine(line);
      if (rank !== null) totalRank = rank;
      const namedRank = firstNumberAfter(line, '[\\u4e00-\\u9fa5A-Za-z0-9]+总分排名|总排名|班级排名|年级排名');
      if (namedRank !== null) namedRanks.push({ label: line.replace(/\d+(?:\.\d+)?/g, '').slice(0, 18), value: namedRank });
    }

    SUBJECTS.forEach((subject) => {
      if (!subject.aliases.some((alias) => line.indexOf(alias) >= 0)) return;
      const subjectPattern = subject.aliases.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const explicit = new RegExp(`(?:${subjectPattern})[^0-9-]*(?:分数|成绩|得分)?[^0-9-]*(-?\\d+(?:\\.\\d+)?)`);
      const match = line.match(explicit);
      const score = match ? Number(match[1]) : null;
      if (score === null || score > 200 || score < 0) return;
      const rank = rankFromLine(line);
      const confidence = /分数|成绩|得分|班名|排名|名次/.test(line) ? 0.92 : 0.74 - Math.min(0.12, index * 0.01);
      const next = makeScoreRecord(subject, score, rank, line, confidence);
      const current = parsedScores[subject.label];
      if (!current || next.confidence >= current.confidence) parsedScores[subject.label] = next;
    });
  });

  if (totalScore === null) {
    const total = Object.keys(parsedScores).reduce((sum, key) => sum + Number(parsedScores[key].score || 0), 0);
    totalScore = total > 0 ? Math.round(total * 10) / 10 : null;
  }

  const scoreList = Object.keys(parsedScores).map((key) => parsedScores[key]);
  return {
    studentName,
    parsedScores,
    parsedRanks: {
      totalScore,
      totalRank,
      classRank: totalRank,
      namedRanks,
      note
    },
    requiresConfirmation: scoreList.some((item) => item.status === '待确认') || scoreList.length === 0,
    missingFields: [
      studentName ? '' : '学生姓名',
      scoreList.length ? '' : '学科分数',
      totalRank ? '' : '总排名/班级排名'
    ].filter(Boolean)
  };
}

function normalizeReportSources(input = {}) {
  const sources = asArray(input.reportSources || input.sources);
  const sourceText = safeText(input.sourceText || input.rawText || input.scoreText);
  const result = sources.map((source, index) => ({
    id: source.id || `source_${index + 1}`,
    type: source.type || source.sourceType || 'manual_text',
    label: source.label || source.title || '家长补充资料',
    text: safeText(source.text || source.rawText || source.content),
    confidence: clamp(source.confidence === undefined ? 0.72 : source.confidence, 0.2, 0.98),
    status: source.status || '待家长确认',
    createdAt: source.createdAt || nowIso(),
    sourceSchemaId: source.sourceSchemaId || source.schemaId || source.type || '',
    sourceSchemaLabel: source.sourceSchemaLabel || source.schemaLabel || source.label || '',
    inputChannel: source.inputChannel || source.channel || '',
    imageCount: Number.isFinite(Number(source.imageCount)) ? Number(source.imageCount) : 0,
    releaseScope: source.releaseScope || '',
    portraitConfidenceWeight: Number.isFinite(Number(source.portraitConfidenceWeight)) ? Number(source.portraitConfidenceWeight) : undefined,
    evidenceGap: Array.isArray(source.evidenceGap) ? source.evidenceGap : [],
    requiredNextEvidence: Array.isArray(source.requiredNextEvidence) ? source.requiredNextEvidence : [],
    nextEvidenceUnlockPlan: source.nextEvidenceUnlockPlan || '',
    blockedFields: Array.isArray(source.blockedFields) ? source.blockedFields : [],
    methodValidationChallengeChain: source.methodValidationChallengeChain || null,
    sourceReadinessBoard: source.sourceReadinessBoard || null,
    structuredCapture: source.structuredCapture || null
  })).filter((source) => source.text || source.type);

  if (sourceText) {
    result.unshift({
      id: `manual_${Date.now ? Date.now() : 1}`,
      type: 'manual_text',
      label: '家长录入资料',
      text: sourceText,
      confidence: 0.74,
      status: '待家长确认',
      createdAt: nowIso()
    });
  }
  return result.slice(0, 30);
}

function normalizeSignals(input = {}) {
  return Object.keys(input || {}).reduce((acc, key) => {
    const value = input[key];
    if (value !== undefined && value !== null && value !== '') acc[key] = value;
    return acc;
  }, {});
}

function computeCompleteness(parts) {
  let score = 0;
  if (Object.keys(parts.parsedScores || {}).length) score += 30;
  if (Object.keys(parts.profileBasics || {}).length >= 2) score += 18;
  if (Object.keys(parts.behaviorSignals || {}).length) score += 14;
  if (Object.keys(parts.emotionSignals || {}).length) score += 12;
  if (Object.keys(parts.interestSignals || {}).length) score += 8;
  if ((parts.assessmentAnswers || []).length >= 5) score += 14;
  return clamp(score, Object.keys(parts.parsedScores || {}).length || (parts.reportSources || []).length ? 28 : 0, 100);
}

function missingItems(parts) {
  const missing = [];
  if (!Object.keys(parts.parsedScores || {}).length) missing.push('成绩单或手动分数');
  if (Object.keys(parts.profileBasics || {}).length < 2) missing.push('年级/年龄/学校类型');
  if (!Object.keys(parts.behaviorSignals || {}).length) missing.push('学习时长/睡眠/专注自评');
  if (!Object.keys(parts.emotionSignals || {}).length) missing.push('焦虑度/学习意愿/亲子沟通');
  if (!Object.keys(parts.interestSignals || {}).length) missing.push('兴趣标签/自认为擅长点');
  if (!(parts.assessmentAnswers || []).length) missing.push('快速测评问卷');
  return missing;
}

function inferAnswersFromText(text = '') {
  const value = String(text || '');
  const answers = [];
  const choose = (id, optionId, confidence = 0.34) => answers.push({ id, optionId, confidence, source: 'text_inferred' });
  if (/圈|标|关键词|图|看/.test(value)) choose('start_mode', 'circle');
  if (/听|讲|说|复述/.test(value)) choose('memory_mode', 'say');
  if (/写|动手|演算|练/.test(value)) choose('favorite_task', 'hands_on');
  if (/步骤|关系|公式|结构|提纲/.test(value)) choose('support_preference', 'hint');
  if (/焦虑|担心|紧张|害怕/.test(value)) choose('exam_feeling', 'worry');
  if (/坐不住|分心|拖拉|磨蹭/.test(value)) choose('next_goal', 'focus');
  if (/错题|反复|总错|回看/.test(value)) choose('next_goal', 'review');
  if (/第一步|不会下手|没思路|列式/.test(value)) choose('next_goal', 'first_step');
  return answers;
}

function scoreAssessmentAnswers(answers = [], contextText = '') {
  const scores = { visual: 0, auditory: 0, kinesthetic: 0, reading: 0, structure: 0, focus: 0, persistence: 0, emotion: 0 };
  const evidence = [];
  const allAnswers = answers.length ? answers : inferAnswersFromText(contextText);
  allAnswers.forEach((answer) => {
    const question = QUICK_ASSESSMENT_QUESTIONS.find((item) => item.id === answer.id);
    if (!question) return;
    const option = question.options.find((item) => item.id === answer.optionId || item.id === answer.option);
    if (!option) return;
    Object.keys(option.weights || {}).forEach((key) => {
      scores[key] = Number(scores[key] || 0) + Number(option.weights[key] || 0);
    });
    evidence.push(`${question.prompt}：${option.label}`);
  });
  return { scores, evidence, answered: allAnswers.length, answers: allAnswers };
}

function topSubjects(parsedScores = {}) {
  return Object.keys(parsedScores)
    .map((key) => parsedScores[key])
    .filter((item) => item && Number.isFinite(Number(item.score)))
    .sort((a, b) => Number(b.score) - Number(a.score));
}

function hasTalentAssessmentSource(parts = {}) {
  return (parts.reportSources || []).some((source) => (
    source.type === 'third_party_assessment'
    || source.type === 'talent_assessment'
    || /天赋|测评|画像|学习类型|学习风格|倾向|视觉型|听觉型|动觉型|多元智能|MBTI/.test(source.text || '')
  ));
}

function hasRealHomeworkEvidence(parts = {}) {
  const behavior = parts.behaviorSignals || {};
  const sourceText = (parts.reportSources || []).map((source) => `${source.type || ''}\n${source.text || ''}`).join('\n');
  return Object.keys(parts.parsedScores || {}).length > 0
    || !!(behavior.firstStep || behavior.childFirstStep || behavior.wrongCause || behavior.weakPoint || behavior.homeworkDelay)
    || /错题|作业|试卷|第一步|卡住|列式|回访|小变式/.test(sourceText);
}

function safeScoreEvidence(subject = '当前学科') {
  return `${subject} 已有成绩/资料线索；报告诊断仍以第一步、错因、回访和第 7 天小变式为准，不展示分数或排名。`;
}

function sanitizeEvidenceSnippet(text = '') {
  const value = safeText(text, 'waiting_for_source_text_evidence');
  if (/没天赋|天生|学渣|笨|智商|能力差|性格缺陷|不适合学习|废了|差生|低能|蠢/.test(value)) {
    return '原文含定性说法，已转为待验证观察';
  }
  return value.slice(0, 64);
}

function buildMethodCandidateIsolation(parts = {}) {
  const talentSource = hasTalentAssessmentSource(parts);
  const realHomeworkEvidence = hasRealHomeworkEvidence(parts);
  const assessmentCount = Array.isArray(parts.assessmentAnswers) ? parts.assessmentAnswers.length : 0;
  return {
    id: 'method_candidate_isolation',
    talentSource,
    realHomeworkEvidence,
    assessmentCount,
    methodCandidateOnly: talentSource && !realHomeworkEvidence,
    localRule: '天赋/学习偏好测评只生成方法候选；没有真实作业、错因、次日回访和第 7 天小变式，不进入长期画像放行。',
    aiBoundary: 'AI 可把测评摘要改写成孩子能试的方法，但不能做天赋定性、升学判断、掌握结论或排名解释。'
  };
}

function buildScoreReleasePolicy(input = {}, sources = [], parsed = {}, behaviorSignals = {}) {
  const sourceText = [
    input.sourceType || '',
    input.materialType || '',
    input.sourceText || '',
    input.scoreText || ''
  ].concat((sources || []).map((source) => `${source.type || ''}\n${source.label || ''}\n${source.text || ''}`)).join('\n');
  const sourceTypeText = [
    input.sourceType || '',
    input.materialType || ''
  ].concat((sources || []).map((source) => `${source.type || ''}\n${source.sourceSchemaId || ''}\n${source.releaseScope || ''}`)).join('\n');
  const typedAsThirdParty = /talent_assessment|third_party_assessment/.test(sourceTypeText);
  const parsedSubjectCount = Object.keys(parsed.parsedScores || {}).length;
  const explicitScoreSourceType = /score_sheet|wrong_question_paper|school_material/.test(sourceTypeText);
  const negativeScoreSheetSignal = /没有成绩单|无成绩单|不是成绩单|未提供成绩单|no score sheet/i.test(sourceText);
  const explicitScoreSheet = explicitScoreSourceType
    || (!negativeScoreSheetSignal && /score_sheet|成绩单|分数单|考试成绩|试卷|错题|老师反馈|学校反馈/.test(sourceText))
    || (!!input.scoreText && parsedSubjectCount > 0);
  const talentOrThirdParty = typedAsThirdParty
    || /天赋|测评|学习类型|学习风格|视觉型|听觉型|动觉型|多元智能|MBTI|澶╄祴|娴嬭瘎|瀛︿範绫诲瀷|瀛︿範椋庢牸|瑙嗚/.test(sourceText);
  const homeworkEvidence = explicitScoreSourceType
    || !!(behaviorSignals.firstStep || behaviorSignals.childFirstStep || behaviorSignals.wrongCause || behaviorSignals.weakPoint || behaviorSignals.homeworkDelay)
    || /错题|作业|试卷|第一步|卡住|列式|回访|小变式|閿欓|浣滀笟|璇曞嵎|绗/.test(sourceText);
  const scoreRankingReleased = explicitScoreSheet && (!talentOrThirdParty || homeworkEvidence);
  const methodCandidateOnly = !scoreRankingReleased && (talentOrThirdParty || parsedSubjectCount > 0);
  const incomingScores = Object.assign({}, parsed.parsedScores || {}, input.parsedScores || {});
  const incomingRanks = Object.assign({}, parsed.parsedRanks || {}, input.parsedRanks || {});
  return {
    id: 'score_release_policy',
    methodCandidateOnly,
    scoreRankingReleased,
    parsedScores: scoreRankingReleased ? incomingScores : {},
    parsedRanks: scoreRankingReleased ? incomingRanks : {},
    unreleasedScoreRankingReference: !scoreRankingReleased && (Object.keys(incomingScores).length || Object.keys(incomingRanks).length) ? {
      releaseScope: 'unreleased_reference',
      sourceType: input.sourceType || input.materialType || 'third_party_assessment',
      reason: '分数/排名必须来自成绩单、错题/试卷或学校材料；测评、家长观察或泛文本里的分数只作未释放参考，不能进入画像、诊断或分享。',
      scoreCount: Object.keys(incomingScores).length,
      hasRank: !!(incomingRanks.classRank || incomingRanks.totalRank || incomingRanks.totalScore)
    } : null,
    localRule: '分数和排名只有成绩单、试卷、错题或学校材料支持时才进入报告画像；天赋测评只放行学习方法候选。'
  };
}
function buildTendencies(parts) {
  const text = (parts.reportSources || []).map((source) => source.text).join('\n');
  const scoredAnswers = scoreAssessmentAnswers(parts.assessmentAnswers || [], text);
  const subjects = topSubjects(parts.parsedScores);
  const tendencies = [];

  if (subjects[0]) {
    tendencies.push({
      id: 'subject_strength',
      label: `${subjects[0].subject}当前表现更突出`,
      description: '更容易在这个学科里形成正反馈，可以用来带动待支持学科的方法迁移。',
      evidence: [safeScoreEvidence(subjects[0].subject)],
      confidence: confidenceLabel(subjects[0].confidence || 0.62),
      missing: ['需要真实错题、第一步和回访证据确认方法是否可迁移']
    });
  }

  const styleScores = scoredAnswers.scores;
  const style = Object.keys(styleScores).sort((a, b) => styleScores[b] - styleScores[a])[0] || '';
  const styleMap = {
    visual: ['视觉整理倾向', '更适合先圈条件、画关系或用颜色区分信息。'],
    auditory: ['听讲复述倾向', '更适合先说出题意或听一遍关键步骤，再落到书面。'],
    kinesthetic: ['动手试做倾向', '更适合用一小步尝试打开任务，而不是长时间听解释。'],
    reading: ['读写整理倾向', '更适合用提纲、笔记和短句把信息固定下来。'],
    structure: ['结构化拆步倾向', '更适合先拆第一步、再做小变式。'],
    focus: ['短时专注支持倾向', '更适合用 15 分钟小目标启动，而不是一次性要求完成很多。'],
    persistence: ['回访巩固倾向', '更适合第二天轻回看，形成可追踪的复盘证据。'],
    emotion: ['安全沟通支持倾向', '更需要家长先问卡点和第一步，而不是追问结果。']
  };
  if (style && styleScores[style] > 0) {
    const item = styleMap[style] || styleMap.structure;
    tendencies.push({
      id: 'style_tendency',
      label: item[0],
      description: item[1],
      evidence: scoredAnswers.evidence.slice(0, 3),
      confidence: confidenceLabel(Math.min(0.82, 0.45 + scoredAnswers.answered * 0.07)),
      missing: scoredAnswers.answered >= 5 ? [] : ['快速测评题还不完整']
    });
  }

  if (/焦虑|担心|害怕|不愿意谈|紧张/.test(text) || parts.emotionSignals.anxiety) {
    tendencies.push({
      id: 'emotion_support',
      label: '需要先降低沟通压力',
      description: '当前更适合用“你第一步先做什么”这类低压力问题承接，而不是直接追问结果。',
      evidence: [parts.emotionSignals.anxiety ? `焦虑度：${parts.emotionSignals.anxiety}` : '资料中出现担心/紧张相关描述'],
      confidence: confidenceLabel(0.58),
      missing: parts.emotionSignals.willingness ? [] : ['学习意愿量表']
    });
  }

  return tendencies.slice(0, 5);
}

function causeFromSignals(subject, parts, isWeak) {
  const text = (parts.reportSources || []).map((source) => source.text).join('\n');
  if (/不会列式|没思路|第一步|看不懂题|读不懂题/.test(text)) return ['方法匹配度', '需要把题目转成可执行第一步'];
  if (/错题|反复|总错|漏|公式|单位/.test(text)) return ['知识点断层', '需要用错因卡把下次检查点留下来'];
  if (parts.emotionSignals.anxiety || /焦虑|担心|紧张/.test(text)) return ['情绪阻抗', '先降低沟通压力，再安排练习'];
  if (parts.behaviorSignals.focusRating || parts.behaviorSignals.studyMinutes || /分心|坐不住|拖拉|磨蹭/.test(text)) return ['专注/习惯问题', '用短时专注舱绑定一个小目标'];
  if (parts.behaviorSignals.classesCount && Number(parts.behaviorSignals.classesCount) >= 3) return ['负荷过高', '先减少低价值重复，保留最关键练习'];
  return isWeak ? ['方法匹配度', '先用一个具体题型验证第一步'] : ['方法匹配度', '保留当前有效方法并做小迁移'];
}

function buildDiagnosisMatrix(parts) {
  const subjects = topSubjects(parts.parsedScores);
  if (!subjects.length) {
    return [{
      subject: '待确认学科',
      status: '待补充',
      summary: '当前还没有可确认的学科分数，只能先基于家长描述给出快速版方向。',
      mainCause: '信息不足',
      secondaryCause: '建议先补一张成绩单或手动录入单科分',
      evidence: ['成绩单字段缺失'],
      confidence: '低',
      missing: ['学科分数', '排名/趋势']
    }];
  }
  const average = subjects.reduce((sum, item) => sum + Number(item.score || 0), 0) / subjects.length;
  return subjects.map((item) => {
    const delta = Number(item.score || 0) - average;
    const isWeak = delta <= -8;
    const isStrong = delta >= 8;
    const cause = causeFromSignals(item.subject, parts, isWeak);
    return {
      subject: item.subject,
      status: isStrong ? '优势可迁移' : isWeak ? '需要支持' : '相对平衡',
      summary: isStrong
        ? `${item.subject}当前表现高于已录入学科均值，适合作为信心和方法迁移的起点。`
        : isWeak
          ? `${item.subject}当前低于已录入学科均值，先找一个最小卡点，不做泛化结论。`
          : `${item.subject}当前接近已录入学科均值，建议用小题验证具体卡点。`,
      mainCause: cause[0],
      secondaryCause: cause[1],
      evidence: [safeScoreEvidence(item.subject), '已录入成绩资料，但不在报告中展示具体分数或排名'],
      confidence: confidenceLabel(item.confidence || 0.58),
      missing: ['需要该学科的真实错因、孩子第一步和最近 3 次回访趋势']
    };
  }).slice(0, 8);
}

function buildOverview(parts, tendencies, matrix) {
  const weak = matrix.find((item) => item.status === '需要支持') || matrix[0];
  const strength = matrix.find((item) => item.status === '优势可迁移') || matrix[0];
  const evidence = [];
  if (strength && strength.subject !== '待确认学科') evidence.push(`${strength.subject}：${strength.status}`);
  if (weak && weak.subject !== strength.subject && weak.subject !== '待确认学科') evidence.push(`${weak.subject}：${weak.status}`);
  return {
    title: '学习画像总览',
    line: strength && weak && weak.status === '需要支持'
      ? `当前更像是「${strength.subject}有可迁移方法，${weak.subject}需要第一步支持」的状态。`
      : '当前资料可以先形成一个快速学习画像，重点是把下一步方案落到真实练习里。',
    evidence: evidence.length ? evidence : ['当前资料完整度仍需补充'],
    confidence: confidenceLabel((parts.reportCompleteness || 0) / 100),
    missing: missingItems(parts).slice(0, 3)
  };
}

function buildRecommendationPlan(parts, matrix) {
  const weak = matrix.find((item) => item.status === '需要支持') || matrix[0] || {};
  const primaryModule = weak.mainCause === '专注/习惯问题' ? 'focus'
    : weak.mainCause === '知识点断层' ? 'review'
      : weak.mainCause === '情绪阻抗' ? 'profile'
        : 'tutor';
  const routeMap = {
    tutor: '/pages/tutor/tutor?from=learning_report',
    focus: '/pages/focus/focus?from=learning_report',
    review: '/pages/review/review?from=learning_report',
    arcade: '/pages/arcade/arcade?from=learning_report',
    profile: '/pages/profile/profile?panel=assessment'
  };
  const subject = weak.subject && weak.subject !== '待确认学科' ? weak.subject : '当前卡点';
  const week = [
    { day: 1, minutes: 15, module: primaryModule, task: `只选 ${subject} 的一个题型，让孩子说出第一步。` },
    { day: 2, minutes: 15, module: 'focus', task: '围绕昨天那一句第一步坐一段，结束后留一句证据。' },
    { day: 3, minutes: 15, module: 'review', task: '回看一个错因，不要求多题，只留下下次检查点。' },
    { day: 4, minutes: 10, module: 'arcade', task: '做 3 分钟轻练，把第一步练熟。' },
    { day: 5, minutes: 20, module: primaryModule, task: '换一个小变式，看能否迁移第一步。' },
    { day: 6, minutes: 10, module: 'profile', task: '家长只问一句，把孩子原话记下来。' },
    { day: 7, minutes: 15, module: 'review', task: '上传或录入最新小测，更新学习画像。' }
  ].map((item) => Object.assign({}, item, { path: routeMap[item.module] || routeMap.tutor }));

  return {
    primaryModule,
    cta: {
      label: primaryModule === 'profile' ? '先看家长话术' : primaryModule === 'focus' ? '进入专注舱' : primaryModule === 'review' ? '去修错题卡点' : '用咕点追问第一步',
      path: routeMap[primaryModule] || routeMap.tutor,
      reason: weak.mainCause ? `因为当前主因更像是：${weak.mainCause}` : '因为当前还需要先确认第一步'
    },
    sevenDayPlan: week,
    parentLine: `今晚家长只问一句：${subject}这一步，你先准备看哪里？`,
    childLine: '我先说出第一步，不用一次做完整。',
    evidence: weak.evidence || [],
    confidence: weak.confidence || '低',
    missing: weak.missing || []
  };
}

function buildSolutionMap(parts, matrix, recommendationPlan) {
  const diagnosis = Array.isArray(matrix) ? matrix : [];
  const plan = recommendationPlan || {};
  const primary = diagnosis.find((item) => item.status === '需要支持') || diagnosis[0] || {};
  const cause = primary.mainCause || '信息不足';
  const evidence = Array.isArray(primary.evidence) ? primary.evidence.slice(0, 3) : [];
  const missing = Array.isArray(primary.missing) ? primary.missing.slice(0, 3) : [];
  return {
    targetSubject: primary.subject || '待确认学科',
    rootCause: cause,
    confidence: primary.confidence || '低',
    evidence,
    missing,
    appHandoff: {
      module: plan.primaryModule || 'tutor',
      path: plan.cta && plan.cta.path ? plan.cta.path : '/pages/tutor/tutor?from=learning_report',
      reason: plan.cta && plan.cta.reason ? plan.cta.reason : '先把报告落到一个可执行小动作。'
    },
    parentScript: plan.parentLine || '家长只问一句：这一步你准备先看哪里？',
    childScript: plan.childLine || '我先说出第一步，不用一次做完整。',
    nextEvidenceRequired: [
      'child_first_step',
      cause === '知识点断层' ? 'wrong_cause_card' : 'focus_or_tutor_record',
      'next_day_revisit'
    ],
    reviewTrigger: missing.length
      ? `补充：${missing[0]}`
      : '7 天后上传一次新小测或错题记录，更新画像。'
  };
}

function buildLongTermLearningPortrait(parts = {}, matrix = [], tendencies = []) {
  const diagnosis = Array.isArray(matrix) ? matrix : [];
  const trendItems = Array.isArray(tendencies) ? tendencies : [];
  const weakest = diagnosis.find((item) => item.status === '需要支持') || diagnosis[0] || {};
  const stable = diagnosis.find((item) => item.status === '相对稳定') || diagnosis.find((item) => item.status === '优势') || {};
  const scores = parts.parsedScores || {};
  const subjects = Object.keys(scores);
  const evidenceCount = [
    parts.reportSources && parts.reportSources.length,
    subjects.length,
    parts.assessmentAnswers && parts.assessmentAnswers.length,
    parts.behaviorSignals && Object.keys(parts.behaviorSignals).length,
    parts.emotionSignals && Object.keys(parts.emotionSignals).length
  ].reduce((sum, item) => sum + Number(item || 0), 0);
  const stability = evidenceCount >= 18 ? 'high' : evidenceCount >= 8 ? 'medium' : 'low';
  const nextEvidence = [];
  if (!subjects.length) nextEvidence.push('补一份最近成绩或错题');
  if (!parts.assessmentAnswers || parts.assessmentAnswers.length < 8) nextEvidence.push('补完 8 个快速画像问题');
  if (!parts.behaviorSignals || !Object.keys(parts.behaviorSignals).length) nextEvidence.push('补一次孩子真实做题过程');
  if (!nextEvidence.length) nextEvidence.push('7 天后用新错题更新画像');
  const subjectName = weakest.subject || stable.subject || '当前学科';
  const causeName = weakest.mainCause || '第一步不清';
  [
    `${subjectName} 同题型第一步回执`,
    `${causeName} 是否连续出现两次`,
    '家长是否只问一句而不代讲'
  ].forEach((item) => {
    if (!nextEvidence.includes(item)) nextEvidence.push(item);
  });

  return {
    title: '长期学习画像',
    stability,
    stabilityLine: stability === 'high'
      ? '资料足够形成阶段性判断，但仍要用下一次错题验证。'
      : stability === 'medium'
        ? '已能判断主要卡点，长期趋势还需要连续 7 天证据。'
        : '当前只是快速画像，不能当作定论。',
    learnerPattern: weakest.mainCause
      ? `当前最需要观察的是：${weakest.subject || '当前学科'} 的 ${weakest.mainCause}。`
      : '先观察孩子能否说出第一步，再判断长期模式。',
    stableStrength: stable.subject
      ? `${stable.subject} 暂时可作为信心入口，不急着加难度。`
      : '还没有稳定强项，先从最小可完成动作建立信心。',
    riskWatch: weakest.secondaryCause
      ? `连续两次出现 ${weakest.secondaryCause} 时，需要降低题量，改成一步追问。`
      : '如果孩子开始沉默或只要答案，立刻退回第一步小黑板。',
    portraitDimensions: [
      {
        id: 'first_step_agency',
        label: '第一步自主性',
        signal: `${subjectName} 是否能先说出可执行小动作`,
        evidence: 'child_first_step',
        nextIntervention: '说不出时只给二选一，不讲完整答案'
      },
      {
        id: 'wrong_cause_stability',
        label: '错因稳定性',
        signal: `${causeName} 是否跨两次同类题重复`,
        evidence: 'wrong_cause_card',
        nextIntervention: '重复两次就降题量，先修错因'
      },
      {
        id: 'transfer_resilience',
        label: '迁移韧性',
        signal: '换一题后是否还能复述同一第一步',
        evidence: 'next_day_revisit',
        nextIntervention: '能迁移再加变式，不能迁移回小黑板'
      },
      {
        id: 'parent_scaffold_load',
        label: '家长脚手架负荷',
        signal: '家长是否需要反复解释才能启动',
        evidence: 'parent_prompt_count',
        nextIntervention: '家长只保留一句追问，减少讲解'
      }
    ],
    trajectoryFlags: [
      stability === 'high' ? '画像稳定：可以看 7 天趋势，不按单题波动调整。' : '画像未稳：先收集连续证据，不急着定性。',
      weakest.mainCause ? `主风险：${weakest.mainCause} 如果连续出现，需要先降题量。` : '主风险待确认：先观察第一步质量。',
      stable.subject ? `可利用强项：从 ${stable.subject} 建立信心入口。` : '强项待确认：先记录孩子完成感。'
    ],
    evidenceConfidenceRubric: [
      '1 条证据：只能做今晚建议',
      '3 条同类证据：可以判断短期卡点',
      '7 天证据：才进入长期画像调整'
    ],
    evidenceToCollect: nextEvidence.slice(0, 5),
    trendLines: trendItems.slice(0, 3).map((item) => `${item.label}: ${item.description}`),
    observationLoop: [
      '当天：只记录孩子第一步',
      '次日：回访同题型是否还能说出第一步',
      '第 7 天：用新错题确认是否迁移'
    ],
    parentDecisionRule: '连续两次能说清第一步才加题量；连续两次沉默就降到小黑板。',
    nextReviewCadence: '每 7 天更新一次，不按单次分数下结论。',
    nextTeacherConference: `如果要和老师沟通，只带三样：${subjectName} 第一脚证据、${causeName} 重复次数、7 天回访结果。`
  };
}

function buildClassroomDecisionBoard(parts = {}, matrix = [], recommendationPlan = {}, solutionMap = {}) {
  const diagnosis = Array.isArray(matrix) ? matrix : [];
  const primary = diagnosis.find((item) => item.status === '需要支持') || diagnosis[0] || {};
  const plan = recommendationPlan || {};
  const solution = solutionMap || {};
  const cause = primary.mainCause || solution.rootCause || '第一步不清';
  const subject = primary.subject || solution.targetSubject || '当前学科';
  return {
    title: '课堂级决策板',
    decisionLine: `${subject} 暂不加题量，先处理 ${cause}。`,
    teacherLens: '像老师备课一样看：先找一个可观察动作，而不是直接看对错率。',
    parentLens: solution.parentScript || plan.parentLine || '家长今晚只问一句：这一步你准备先看哪里？',
    classLikeObservation: [
      `观察点：${subject} 能否独立说出第一步`,
      `干预点：${cause} 出现时立刻退回小黑板`,
      '复核点：第二天同类题能否迁移'
    ],
    observationRubric: [
      {
        id: 'observe',
        label: '观察',
        metric: '启动时间',
        rule: `孩子看到 ${subject} 同类题，30 秒内能否说出第一步`,
        evidence: 'child_first_step'
      },
      {
        id: 'intervene',
        label: '干预',
        metric: '提示强度',
        rule: `${cause} 出现时，只给第一步小黑板或二选一`,
        evidence: 'hint_level'
      },
      {
        id: 'review',
        label: '复核',
        metric: '迁移结果',
        rule: '第二天换题，仍看能否复述同一小动作',
        evidence: 'next_day_revisit'
      }
    ],
    interventionLadder: [
      { level: 1, label: '独立说第一步', action: '不讲答案，只让孩子说出下一笔' },
      { level: 2, label: '二选一启动', action: '给两个可能入口，让孩子选一个并说明理由' },
      { level: 3, label: '小黑板降阶', action: '只画关系或条件，不推完整解法' },
      { level: 4, label: '减少题量', action: '同错因重复时停刷题，改成 3 分钟轻练习' }
    ],
    classroomEvidencePacket: [
      `${subject} 第一脚记录`,
      `${cause} 重复次数`,
      '同类题次日回访',
      '家长是否只问一句'
    ],
    intervention: plan.cta && plan.cta.label
      ? `${plan.cta.label}: ${plan.cta.reason || '把报告落到一个小动作'}`
      : '先用点拨页让孩子说出第一步。',
    evidenceRule: Array.isArray(solution.nextEvidenceRequired) && solution.nextEvidenceRequired.length
      ? solution.nextEvidenceRequired.join(' / ')
      : 'child_first_step / wrong_cause_card / next_day_revisit',
    stopRule: '如果连续两次答不上来，不继续讲答案，改用小黑板画第一步。',
    escalationRule: '如果 7 天内同一错因出现 3 次，先减少题量，改成 3 分钟轻练习和一次家长复盘。',
    successRule: '如果连续 2 天能独立说出第一步，再进入变式练习，不提前加难题。',
    classroomCadence: '当天观察启动，次日复核迁移，第 7 天决定加题量还是降阶。',
    nextConferenceQuestion: `下次复盘只问：${subject} 这类题，孩子能否自己说出第一步？`,
    shareableSummary: `${subject} 的下一次干预重点是 ${cause}，用 7 天证据复核，不按一次表现定性。`
  };
}

function buildFamilyDecisionMemo(parts = {}, matrix = [], recommendationPlan = {}, solutionMap = {}, portrait = {}, classroom = {}) {
  const diagnosis = Array.isArray(matrix) ? matrix : [];
  const primary = diagnosis.find((item) => item.status === '需要支持') || diagnosis[0] || {};
  const plan = recommendationPlan || {};
  const solution = solutionMap || {};
  const subject = primary.subject || solution.targetSubject || '当前学科';
  const cause = primary.mainCause || solution.rootCause || '第一步不清';
  const evidence = Array.isArray(solution.nextEvidenceRequired) && solution.nextEvidenceRequired.length
    ? solution.nextEvidenceRequired
    : ['child_first_step', 'wrong_cause_card', 'next_day_revisit'];
  const portraitEvidence = Array.isArray(portrait.evidenceToCollect) ? portrait.evidenceToCollect.slice(0, 3) : [];
  return {
    title: '家庭决策书',
    tonightDecision: `${subject} 今晚不加题量，先处理「${cause}」。`,
    doNotDo: [
      '不按一次分数给孩子定性',
      '不直接讲完整答案',
      '不把薄弱学科一次性铺开'
    ],
    evidenceChecklist: [
      `孩子能否说出 ${subject} 的第一步`,
      `错因是否写成一张可回访卡`,
      `明天是否还能复述同一小步`
    ].concat(portraitEvidence).slice(0, 6),
    parentMeetingScript: [
      solution.parentScript || plan.parentLine || '家长只问：这一步你准备先看哪里？',
      classroom.nextConferenceQuestion || `下次复盘只问：${subject} 这类题，孩子能否自己说出第一步？`,
      portrait.parentDecisionRule || '连续两次能说清第一步才加题量。'
    ],
    decisionCard: {
      subject,
      cause,
      tonight: `今晚只处理 ${cause} 的第一步，不扩题量。`,
      tomorrow: '明天换一题回访，看是否能迁移。',
      shareTitle: `${subject} 7 天家庭学习决策`,
      shareSummary: `${cause} 先用第一步证据复核，不用一次分数定性。`
    },
    weeklyReviewAgenda: [
      '本周哪两次孩子能自己启动？',
      `哪一次 ${cause} 重复出现？`,
      '家长有没有忍住不讲完整答案？',
      '下周是加一点变式，还是继续降阶？'
    ],
    intakeSourcePlan: [
      {
        id: 'score_sheet',
        label: '成绩单/周测',
        whatToUpload: '粘贴分数、班级位置或老师反馈摘要',
        localRule: '只做学科强弱、趋势和待确认字段，不做排名羞辱。',
        aiUse: '把数字翻译成家长能听懂的行动建议。'
      },
      {
        id: 'wrong_question_paper',
        label: '错题/试卷',
        whatToUpload: '上传或粘贴错题、孩子原想法和卡住的一步',
        localRule: '抽成题型、错因、第一步、明天回访和第 7 天复核。',
        aiUse: '生成苏格拉底追问、小黑板话术和同错因小变式。'
      },
      {
        id: 'talent_assessment',
        label: '天赋测评/学习偏好',
        whatToUpload: '录入第三方测评摘要，或完成 15 题快速测评',
        localRule: '只作为学习偏好候选，必须和作业证据、回访证据交叉确认。',
        aiUse: '解释孩子更适合先看图、先复述、先动笔还是先拆步骤。'
      },
      {
        id: 'school_feedback',
        label: '学校/老师材料',
        whatToUpload: '录入老师评语、课堂观察、作业批注或家校沟通要点',
        localRule: '只生成观察问题、家庭动作和安全交接字段。',
        aiUse: '把家校沟通整理成不带原题和隐私的短摘要。'
      }
    ],
    publicK12SourceStrategy: {
      title: '公开资料借力方式',
      useAs: '借课程标准、学段、学科核心素养、题型结构和交互框架。',
      doNotUseAs: '不复制教材正文、教辅题库、平台视频、讲义图片或他人解析。',
      productUse: '本地代码把公开骨架转成 grade/subject/unit/concept/ability/evidence；AI 只基于用户自己的资料改写解释。'
    },
    aiLocalWorkSplit: [
      { id: 'local', label: '本地规则管', action: '资料类型、证据门槛、题型轴、错因、复习间隔、分享字段和报告放行。' },
      { id: 'ai', label: 'AI 管', action: '儿童可听懂的解释、家长摘要、追问改写、小黑板文案和同错因变式。' },
      { id: 'blocked', label: '禁止交给 AI', action: '最终答案、掌握结论、天赋定性、分数排名、奖励发放和家校放行。' }
    ],
    parentActionLadder: [
      { level: 1, label: '只问一句', action: solution.parentScript || plan.parentLine || '这一步你准备先看哪里？' },
      { level: 2, label: '给二选一', action: '让孩子在两个入口里选一个' },
      { level: 3, label: '停讲答案', action: '退回小黑板，保留孩子自己的第一笔' }
    ],
    sevenDayDecisionGate: {
      continueRule: '连续 2 天能独立说出第一步，才进入变式练习。',
      reduceRule: '连续 2 次沉默或同错因重复，减少题量，退回第一步小黑板。',
      evidenceRule: evidence.join(' / ')
    },
    shareLine: `${subject} 家庭决策：先看 ${cause}，7 天后用证据复核。`,
    route: plan.cta && plan.cta.path ? plan.cta.path : '/pages/tutor/tutor?from=family_decision_memo'
  };
}

function buildTonightDecisionBrief(parts = {}, matrix = [], familyDecision = {}, parentDecisionTrust = {}, questionBankRecallReportBridge = {}, socraticPromptQualityJudge = null) {
  const diagnosis = Array.isArray(matrix) ? matrix : [];
  const primary = diagnosis.find((item) => String(item.status || '').indexOf('支持') >= 0) || diagnosis[0] || {};
  const subject = primary.subject || (familyDecision.decisionCard && familyDecision.decisionCard.subject) || '当前学科';
  const cause = primary.mainCause || (familyDecision.decisionCard && familyDecision.decisionCard.cause) || '第一步不清';
  const trustScore = Number(parentDecisionTrust.score || 0);
  const recallReady = questionBankRecallReportBridge && questionBankRecallReportBridge.status === 'ready';
  const promptStop = socraticPromptQualityJudge && Array.isArray(socraticPromptQualityJudge.stopConditions)
    ? socraticPromptQualityJudge.stopConditions.slice(0, 3)
    : [
      { id: 'answer_request', label: '孩子继续要答案', action: '停讲完整答案，回到第一步。' },
      { id: 'repeated_silence', label: '连续沉默', action: '降到 A/B 微选择。' },
      { id: 'transfer_fail', label: '变式失败', action: '停止加题，明天回访。' }
    ];
  const parentRules = socraticPromptQualityJudge && Array.isArray(socraticPromptQualityJudge.parentDecisionRules)
    ? socraticPromptQualityJudge.parentDecisionRules.slice(0, 4)
    : [];
  const actionLevel = trustScore >= 65 && recallReady ? 'can_try_variant' : trustScore >= 40 ? 'action_only' : 'collect_evidence';
  return {
    id: 'tonight_decision_brief',
    title: '今晚决策书',
    actionLevel,
    subject,
    cause,
    headline: actionLevel === 'can_try_variant'
      ? `${subject} 可以做 1 张小变式，但必须先复述第一步。`
      : actionLevel === 'action_only'
        ? `${subject} 今晚只做一个动作：把「${cause}」退回第一步。`
        : `${subject} 今晚先收证据，不评价能力，不加题量。`,
    tonightDo: [
      `先问：这类题第一步先看哪里？`,
      `只处理「${cause}」这一处，不扩到整章。`,
      recallReady ? '完成 1 轮主动回忆，再停。' : '说不出第一步就用 A/B 微选择。'
    ],
    tonightDoNot: [
      '不直接讲完整答案',
      '不按一次表现贴标签',
      '不把分享变成排名或晒分'
    ],
    parentScript: familyDecision.parentMeetingScript && familyDecision.parentMeetingScript[0]
      ? familyDecision.parentMeetingScript[0]
      : '家长只问一句：这一步你准备先看哪里？',
    childScript: '孩子只需要说出自己的第一步，不需要一次讲完整过程。',
    stopConditions: promptStop,
    tomorrowRevisit: questionBankRecallReportBridge && questionBankRecallReportBridge.returnWindowLine
      ? questionBankRecallReportBridge.returnWindowLine
      : '明天换一题，只回访同一个第一步。',
    releaseGate: actionLevel === 'can_try_variant'
      ? '能复述第一步 + 明天回访通过，才进入小变式。'
      : '第一步、错因卡、明天回访三项缺一项，就不更新长期画像。',
    evidenceChecklist: [
      'child_first_step',
      'wrong_cause_card',
      'next_day_revisit',
      'parent_question_used',
      'safe_share_boundary'
    ],
    parentDecisionRules: parentRules,
    sharePayload: {
      allowed_fields: ['subject', 'cause', 'tonight_action', 'parent_question', 'tomorrow_revisit', 'evidence_gap'],
      blocked_fields: ['original_question', 'full_answer', 'raw_dialogue', 'score', 'ranking', 'child_private_note']
    },
    shareLine: '安全接力只带今晚动作、家长问题、明日回访和证据缺口，不带原题、答案、完整对话、分数或排名。',
    route: '/pages/profile/profile?from=tonight_decision_brief'
  };
}

function buildPortraitConfidenceSystem(parts = {}, matrix = [], portrait = {}, classroom = {}, familyDecision = {}) {
  const diagnosis = Array.isArray(matrix) ? matrix : [];
  const subjects = Object.keys(parts.parsedScores || {});
  const assessmentCount = Array.isArray(parts.assessmentAnswers) ? parts.assessmentAnswers.length : 0;
  const sourceCount = Array.isArray(parts.reportSources) ? parts.reportSources.length : 0;
  const behaviorCount = parts.behaviorSignals ? Object.keys(parts.behaviorSignals).length : 0;
  const emotionCount = parts.emotionSignals ? Object.keys(parts.emotionSignals).length : 0;
  const behaviorSignals = parts.behaviorSignals || {};
  const nextDayRevisitCount = Number(behaviorSignals.nextDayRevisitCount || (behaviorSignals.nextDayRevisit ? 1 : 0) || 0);
  const sameWrongCauseRecurrence = Number(behaviorSignals.sameWrongCauseRecurrence || 0);
  const day7VariantReady = !!(behaviorSignals.day7VariantResult || behaviorSignals.day7VariantStatus === 'passed' || behaviorSignals.day7VariantReady);
  const twoWeekStabilityReady = !!(behaviorSignals.twoWeekStabilityCheck || behaviorSignals.twoWeekStabilityStatus === 'stable');
  const methodCandidateIsolation = buildMethodCandidateIsolation(parts);
  const assessmentEvidenceScore = methodCandidateIsolation.methodCandidateOnly ? 0 : Math.min(assessmentCount, 15) * 3;
  const sourceEvidenceScore = methodCandidateIsolation.methodCandidateOnly ? 0 : sourceCount * 8;
  const longitudinalEvidenceScore = nextDayRevisitCount * 8
    + sameWrongCauseRecurrence * 6
    + (day7VariantReady ? 18 : 0)
    + (twoWeekStabilityReady ? 22 : 0);
  const evidenceScore = subjects.length * 10 + assessmentEvidenceScore + sourceEvidenceScore + behaviorCount * 5 + emotionCount * 4 + longitudinalEvidenceScore;
  const confidenceLevel = evidenceScore >= 120 ? 'high' : evidenceScore >= 70 ? 'medium' : 'low';
  const primary = diagnosis.find((item) => String(item.status || '').indexOf('\u652f\u6301') >= 0) || diagnosis[0] || {};
  const subject = primary.subject || '\u5f53\u524d\u5b66\u79d1';
  const cause = primary.mainCause || '\u7b2c\u4e00\u6b65\u4e0d\u6e05';
  const readyCount = [subjects.length >= 3, !methodCandidateIsolation.methodCandidateOnly && assessmentCount >= 8, behaviorCount >= 2].filter(Boolean).length;
  const evidenceLedger = [
    { id: 'score_or_task', label: '\u6210\u7ee9/\u4efb\u52a1\u8bc1\u636e', status: subjects.length >= 3 ? 'ready' : 'weak', proof: subjects.length ? `${subjects.length} \u4e2a\u5b66\u79d1\u5df2\u8bb0\u5f55` : '\u7f3a\u5c11\u53ef\u786e\u8ba4\u5b66\u79d1\u8bb0\u5f55' },
    { id: 'assessment', label: '\u753b\u50cf\u95ee\u5377', status: methodCandidateIsolation.methodCandidateOnly ? 'candidate_only' : assessmentCount >= 8 ? 'ready' : 'weak', proof: methodCandidateIsolation.methodCandidateOnly ? '仅作为学习方法候选，等待真实作业和回访验证' : `${assessmentCount}/15 \u4e2a\u95ee\u9898\u5df2\u8bb0\u5f55` },
    { id: 'behavior', label: '\u505a\u9898\u8fc7\u7a0b', status: behaviorCount >= 2 ? 'ready' : 'weak', proof: behaviorCount ? `${behaviorCount} \u7c7b\u884c\u4e3a\u4fe1\u53f7` : '\u7f3a\u5c11\u771f\u5b9e\u505a\u9898\u8fc7\u7a0b' },
    { id: 'next_day', label: '\u9694\u5929\u56de\u8bbf', status: nextDayRevisitCount > 0 ? 'ready' : portrait.nextReviewCadence ? 'pending' : 'missing', proof: nextDayRevisitCount > 0 ? `${nextDayRevisitCount} 次隔天回访证据` : portrait.nextReviewCadence || '\u9700\u8981\u660e\u5929\u56de\u8bbf\u9a8c\u8bc1' },
    { id: 'day7_variant', label: '第 7 天变式', status: day7VariantReady ? 'ready' : 'locked', proof: day7VariantReady ? '第 7 天小变式已有结果' : '还不能用单次表现写长期画像' },
    { id: 'two_week_stability', label: '两周稳定性', status: twoWeekStabilityReady ? 'ready' : 'locked', proof: twoWeekStabilityReady ? '两周稳定性检查已通过' : '还需要跨周稳定证据' }
  ];
  const portraitStage = twoWeekStabilityReady && day7VariantReady
    ? 'weekly_portrait_candidate'
    : nextDayRevisitCount > 0
      ? 'method_candidate'
      : 'tonight_action_only';
  return {
    id: 'portrait_confidence_system',
    title: '\u957f\u671f\u753b\u50cf\u53ef\u4fe1\u5ea6\u8d26\u672c',
    confidenceLevel,
    evidenceScore,
    portraitStage,
    portraitStageLabel: portraitStage === 'weekly_portrait_candidate'
      ? '可进入周画像候选'
      : portraitStage === 'method_candidate'
        ? '方法候选，继续回访'
        : '只支持今晚行动',
    portraitStageReason: portraitStage === 'weekly_portrait_candidate'
      ? '已有隔天、第 7 天和两周稳定性证据，仍按候选处理，不贴天赋标签。'
      : portraitStage === 'method_candidate'
        ? '已有回访证据，但第 7 天或两周稳定性不足，只能推荐学习方法。'
        : '证据不足以形成画像，只能给今晚第一步和家长一问。',
    portraitNextEvidenceAction: portraitStage === 'weekly_portrait_candidate'
      ? '下次只复核同一错因是否迁移，不增加题量。'
      : portraitStage === 'method_candidate'
        ? '补第 7 天小变式和两周稳定性检查。'
        : '先补孩子第一步、错因猜测和明天回访。',
    longitudinalEvidence: {
      nextDayRevisitCount,
      sameWrongCauseRecurrence,
      day7VariantReady,
      twoWeekStabilityReady,
      releaseRule: '长期画像必须由本地规则读取回访证据后放行，AI 只负责改写解释。'
    },
    methodCandidateIsolation,
    summary: confidenceLevel === 'high'
      ? '\u5f53\u524d\u8bc1\u636e\u8db3\u591f\u5f62\u6210\u9636\u6bb5\u5224\u65ad\uff0c\u4f46\u4ecd\u6309 7 \u5929\u56de\u8bbf\u66f4\u65b0\uff0c\u4e0d\u6309\u5355\u6b21\u5206\u6570\u5b9a\u6027\u3002'
      : confidenceLevel === 'medium'
        ? '\u5f53\u524d\u53ef\u4ee5\u6307\u5bfc\u4eca\u665a\u884c\u52a8\uff0c\u4f46\u957f\u671f\u753b\u50cf\u8fd8\u9700\u8981\u9694\u5929\u548c\u7b2c 7 \u5929\u8bc1\u636e\u786e\u8ba4\u3002'
        : '\u5f53\u524d\u53ea\u80fd\u4f5c\u4e3a\u5feb\u901f\u5efa\u8bae\uff0c\u4e0d\u80fd\u5f53\u4f5c\u957f\u671f\u7ed3\u8bba\u3002',
    evidenceLedger,
    decisionThresholds: [
      { id: 'act_tonight', label: '\u4eca\u665a\u53ef\u884c\u52a8', rule: '\u6709\u4e00\u4e2a\u660e\u786e\u5361\u70b9\u548c\u4e00\u4e2a\u53ef\u6267\u884c\u7b2c\u4e00\u6b65\u5373\u53ef\u884c\u52a8\u3002', met: !!primary.mainCause },
      { id: 'update_portrait', label: '\u66f4\u65b0\u753b\u50cf', rule: '\u81f3\u5c11 3 \u7c7b\u8bc1\u636e\u540c\u65f6\u6307\u5411\u540c\u4e00\u9519\u56e0\uff0c\u624d\u66f4\u65b0\u957f\u671f\u753b\u50cf\u3002', met: readyCount >= 3 && !methodCandidateIsolation.methodCandidateOnly },
      { id: 'increase_load', label: '\u589e\u52a0\u9898\u91cf', rule: '\u8fde\u7eed 2 \u5929\u80fd\u72ec\u7acb\u8bf4\u51fa\u7b2c\u4e00\u6b65\uff0c\u624d\u589e\u52a0\u53d8\u5f0f\u6216\u9898\u91cf\u3002', met: false },
      { id: 'reduce_load', label: '\u964d\u7ea7\u5904\u7406', rule: '\u540c\u4e00\u9519\u56e0\u8fde\u7eed 2 \u6b21\u5931\u8d25\uff0c\u7acb\u5373\u964d\u5230\u5c0f\u9ed1\u677f\u548c\u9519\u56e0\u5361\u3002', met: String(primary.status || '').indexOf('\u652f\u6301') >= 0 }
    ],
    observationCadence: [
      { day: '\u4eca\u665a', check: `${subject} \u662f\u5426\u80fd\u8bf4\u51fa\u7b2c\u4e00\u6b65`, action: '\u53ea\u8bb0\u5f55\u5b69\u5b50\u539f\u8bdd\uff0c\u4e0d\u8bb2\u5b8c\u6574\u7b54\u6848\u3002' },
      { day: '\u660e\u5929', check: `${cause} \u662f\u5426\u8fd8\u80fd\u590d\u8ff0`, action: '\u6362\u4e00\u5f20\u540c\u7c7b\u5361\u56de\u8bbf\u3002' },
      { day: '\u7b2c 3 \u5929', check: '\u80fd\u5426\u505a\u8fd1\u8fc1\u79fb', action: '\u6362\u4e00\u4e2a\u5c0f\u6761\u4ef6\uff0c\u4e0d\u52a0\u96be\u5ea6\u3002' },
      { day: '\u7b2c 7 \u5929', check: '\u662f\u5426\u8fdb\u5165\u957f\u671f\u753b\u50cf', action: '\u7528\u65b0\u9519\u9898/\u5c0f\u6d4b\u590d\u6838\u7ed3\u8bba\u3002' }
    ],
    parentTrustContract: {
      line: '\u62a5\u544a\u53ea\u7ed9\u5bb6\u5ead\u884c\u52a8\u5efa\u8bae\uff0c\u4e0d\u628a\u5b69\u5b50\u8d34\u6807\u7b7e\u3002',
      doNotShow: ['\u5b8c\u6574\u5bf9\u8bdd', '\u539f\u59cb\u7167\u7247', '\u6392\u540d\u523a\u6fc0', '\u5355\u6b21\u5206\u6570\u5b9a\u6027'],
      shareLine: '\u53ef\u5206\u4eab\u7684\u53ea\u6709\u884c\u52a8\u5efa\u8bae\u3001\u56de\u8bbf\u65f6\u95f4\u548c\u8bc1\u636e\u7f3a\u53e3\u3002'
    },
    escalationRule: classroom.escalationRule || '7 \u5929\u5185\u540c\u4e00\u9519\u56e0\u51fa\u73b0 3 \u6b21\uff0c\u5148\u964d\u9898\u91cf\uff0c\u518d\u56de\u5c0f\u9ed1\u677f\u3002',
    familyDecisionLine: familyDecision.tonightDecision || `\u4eca\u665a\u53ea\u5904\u7406 ${subject} \u7684 ${cause}\u3002`,
    evidenceRequired: ['evidence_ledger', 'decision_thresholds', 'observation_cadence', 'parent_trust_contract']
  };
}

function buildParentDecisionTrustSystem(parts = {}, matrix = [], portraitConfidence = {}, familyDecision = {}, classroom = {}) {
  const diagnosis = Array.isArray(matrix) ? matrix : [];
  const primary = diagnosis.find((item) => String(item.status || '').indexOf('\u652f\u6301') >= 0) || diagnosis[0] || {};
  const subject = primary.subject || '\u5f53\u524d\u5b66\u79d1';
  const cause = primary.mainCause || '\u7b2c\u4e00\u6b65\u4e0d\u6e05';
  const ledger = Array.isArray(portraitConfidence.evidenceLedger) ? portraitConfidence.evidenceLedger : [];
  const thresholds = Array.isArray(portraitConfidence.decisionThresholds) ? portraitConfidence.decisionThresholds : [];
  const readyEvidence = ledger.filter((item) => item.status === 'ready').length;
  const weakEvidence = ledger.filter((item) => item.status === 'weak' || item.status === 'missing').length;
  const metThresholds = thresholds.filter((item) => item.met).length;
  const score = Math.max(0, Math.min(100, readyEvidence * 22 + metThresholds * 12 - weakEvidence * 8));
  const level = score >= 72 ? 'can_decide' : score >= 44 ? 'observe_first' : 'collect_evidence';
  const decisionLine = level === 'can_decide'
    ? `今晚可以围绕 ${subject} 的 ${cause} 做一次低压干预，但 7 天内仍需复核。`
    : level === 'observe_first'
      ? `今晚只做 ${subject} 的第一步观察，不升级题量，也不改长期判断。`
      : `当前证据不足，只能收集 ${subject} 的第一步和错因证据。`;
  return {
    id: 'parent_decision_trust_system',
    title: '家长决策可信度系统',
    level,
    score,
    decisionLine,
    decisionDeck: [
      {
        id: 'tonight',
        label: '今晚能不能行动',
        verdict: level === 'collect_evidence' ? '先收证据' : '可以做一个小动作',
        action: familyDecision.tonightDecision || `只处理 ${subject} 的 ${cause}，不加题量。`,
        evidence: 'child_first_step'
      },
      {
        id: 'portrait',
        label: '能不能更新长期画像',
        verdict: metThresholds >= 2 ? '可临时更新' : '先不要定性',
        action: '至少等到明天回访和第 7 天复核后再写入长期画像。',
        evidence: 'next_day_revisit / day7_review'
      },
      {
        id: 'load',
        label: '能不能增加难度',
        verdict: '暂不增加',
        action: '连续两天能独立说出第一步后，才增加近迁移或题量。',
        evidence: 'two_day_first_step_stable'
      },
      {
        id: 'help',
        label: '什么时候需要家长介入',
        verdict: String(primary.status || '').indexOf('\u652f\u6301') >= 0 ? '需要低压介入' : '先观察',
        action: classroom.stopRule || '连续两次说不出第一步，就退回小黑板，不继续讲答案。',
        evidence: 'repeated_wrong_cause'
      }
    ],
    guardrails: [
      '不按一次分数给孩子贴标签。',
      '不把完整对话、原始照片、排名或隐私评论放进分享卡。',
      '不因为报告很完整就直接加题量。',
      '不把 AI 建议当成老师结论，只当今晚行动参考。'
    ],
    evidenceGaps: ledger
      .filter((item) => item.status !== 'ready')
      .map((item) => `${item.label}：${item.proof}`)
      .slice(0, 4),
    weeklyDecisionReview: [
      { day: '今晚', check: '孩子是否能说出第一步', action: '只问一句，不讲完整答案。' },
      { day: '明天', check: `${cause} 是否复现`, action: '换一张同类卡回访。' },
      { day: '第 3 天', check: '能不能做近迁移', action: '只换一个条件，不增加难度。' },
      { day: '第 7 天', check: '证据是否足够稳定', action: '再决定进入长期画像、继续观察或降级。' }
    ],
    shareBoundary: '分享只带行动建议、证据缺口和回访时间，不带原题、答案、分数、排名和完整对话。',
    route: familyDecision.route || '/pages/profile/profile?from=parent_decision_trust'
  };
}

function buildLongitudinalPortraitTimeline(parts = {}, matrix = [], portrait = {}, portraitConfidence = {}, parentDecisionTrust = {}, familyDecision = {}) {
  const diagnosis = Array.isArray(matrix) ? matrix : [];
  const primary = diagnosis.find((item) => String(item.status || '').indexOf('支持') >= 0) || diagnosis[0] || {};
  const subject = primary.subject || '当前学科';
  const cause = primary.mainCause || '第一步不清';
  const evidenceLedger = Array.isArray(portraitConfidence.evidenceLedger) ? portraitConfidence.evidenceLedger : [];
  const weakLedger = evidenceLedger.filter((item) => item.status !== 'ready');
  const weeklyReview = Array.isArray(parentDecisionTrust.weeklyDecisionReview) ? parentDecisionTrust.weeklyDecisionReview : [];
  const evidenceToCollect = Array.isArray(portrait.evidenceToCollect) && portrait.evidenceToCollect.length
    ? portrait.evidenceToCollect
    : ['child_first_step', 'wrong_cause_card', 'next_day_revisit'];
  const timeline = [
    {
      id: 'tonight',
      day: '今晚',
      portraitQuestion: `${subject} 这类题，孩子能不能先说出第一步？`,
      evidence: 'child_first_step',
      parentAction: familyDecision.tonightDecision || `只处理 ${subject} 的 ${cause}，不加题量。`,
      decision: '只生成今晚行动，不更新长期结论。'
    },
    {
      id: 'tomorrow',
      day: '明天',
      portraitQuestion: `${cause} 是否还能被孩子自己复述？`,
      evidence: 'next_day_revisit',
      parentAction: '换一张同类小卡回访，不看单次分数。',
      decision: '如果复述失败，降到小黑板；如果复述成功，进入近迁移。'
    },
    {
      id: 'day_3',
      day: '第3天',
      portraitQuestion: '换一个小条件后，第一步还能不能迁移？',
      evidence: 'near_transfer_attempt',
      parentAction: '只换一个条件，不增加题量。',
      decision: '迁移成功才进入题型训练；迁移失败继续错因回放。'
    },
    {
      id: 'day_7',
      day: '第7天',
      portraitQuestion: `${subject} 的 ${cause} 是否连续出现？`,
      evidence: 'weekly_action_card',
      parentAction: '用一张周复盘行动卡判断加题量还是降阶。',
      decision: '满足 3 类证据一致，才写入长期画像候选。'
    },
    {
      id: 'day_14',
      day: '第14天',
      portraitQuestion: '同一方法是否跨两周稳定？',
      evidence: 'two_week_stability_check',
      parentAction: '只比较证据，不比较排名。',
      decision: '稳定后才升级学习策略；不稳定则保留观察。'
    }
  ];
  const updateGates = [
    { id: 'candidate', label: '候选画像', rule: '有今晚第一步 + 明天回访，才进入候选。', evidence: ['child_first_step', 'next_day_revisit'] },
    { id: 'weekly', label: '周画像', rule: '第 7 天至少 3 类证据一致，才更新画像。', evidence: ['wrong_cause_card', 'near_transfer_attempt', 'weekly_action_card'] },
    { id: 'stable', label: '稳定画像', rule: '连续两周同一方法有效，才升级策略。', evidence: ['two_week_stability_check'] },
    { id: 'downgrade', label: '降级条件', rule: '连续 2 次沉默、要答案或同错因失败，立刻回小黑板。', evidence: ['silent_child', 'answer_request', 'repeated_wrong_cause'] }
  ];
  return {
    id: 'longitudinal_portrait_timeline',
    title: '长期画像时间轴',
    status: evidenceLedger.length >= 4 ? 'trackable' : 'collecting',
    summary: `围绕 ${subject} 的「${cause}」，把今晚动作、明天回访、第 7 天复核和两周稳定性连成一条画像线。`,
    parentLine: '家长每次只看一个问题：孩子是否能用自己的话说出第一步。',
    timeline,
    updateGates,
    riskTransitions: [
      `${cause} 连续 2 次出现：降题量，回小黑板。`,
      '孩子沉默或只要答案：停止讲解，改二选一启动。',
      '连续 2 天能独立复述第一步：允许进入近迁移。',
      '第 7 天证据不足：不更新长期画像，只保留今晚建议。'
    ],
    evidenceBacklog: weakLedger.map((item) => `${item.label}：${item.proof}`).concat(evidenceToCollect).slice(0, 6),
    weeklyReview,
    shareBoundary: '时间轴只分享画像问题、回访动作和证据缺口；不分享原题、答案、分数、排名或完整对话。',
    evidenceRequired: ['longitudinal_timeline', 'update_gates', 'risk_transitions', 'evidence_backlog', 'privacy_boundary']
  };
}

function buildPortraitEvidenceMaturitySystem(parts = {}, portraitConfidence = {}, parentDecisionTrust = {}, longitudinalTimeline = {}, familyDecision = {}) {
  const ledger = Array.isArray(portraitConfidence.evidenceLedger) ? portraitConfidence.evidenceLedger : [];
  const thresholds = Array.isArray(portraitConfidence.decisionThresholds) ? portraitConfidence.decisionThresholds : [];
  const updateGates = Array.isArray(longitudinalTimeline.updateGates) ? longitudinalTimeline.updateGates : [];
  const timeline = Array.isArray(longitudinalTimeline.timeline) ? longitudinalTimeline.timeline : [];
  const readyEvidence = ledger.filter((item) => item.status === 'ready').length;
  const weakEvidence = ledger.filter((item) => item.status !== 'ready').length;
  const metThresholds = thresholds.filter((item) => item.met).length;
  const maturityScore = Math.max(0, Math.min(100, readyEvidence * 18 + metThresholds * 14 + timeline.length * 4 - weakEvidence * 6));
  const maturityLevel = maturityScore >= 76 ? '可进入周画像' : maturityScore >= 48 ? '只支持今晚行动' : '先补证据';
  const primaryAction = familyDecision.tonightDecision || '今晚只做一个第一步动作，不加题量。';
  const maturityLanes = [
    {
      id: 'tonight_action',
      label: '今晚行动证据',
      minimumEvidence: ['孩子说出第一步', '错因被命名'],
      allowedDecision: primaryAction,
      blockedDecision: '不能据此给孩子贴长期标签。'
    },
    {
      id: 'next_day_check',
      label: '隔日回访证据',
      minimumEvidence: ['同类题回访', '孩子能复述错因'],
      allowedDecision: '可以决定明天继续同一小步或退回小黑板。',
      blockedDecision: '不能因为当晚做对就增加题量。'
    },
    {
      id: 'weekly_portrait',
      label: '周画像证据',
      minimumEvidence: ['第 7 天复核', '近迁移一次', '家长低压观察'],
      allowedDecision: '可以把错因写入长期画像候选。',
      blockedDecision: '不能分享分数、排名、原题答案或完整对话。'
    },
    {
      id: 'two_week_stability',
      label: '两周稳定证据',
      minimumEvidence: ['两周同类证据一致', '策略调整后仍有效'],
      allowedDecision: '可以升级策略或进入更高一层题型。',
      blockedDecision: '不能跳过老师/家长人工判断。'
    }
  ];
  const decisionLocks = [
    {
      id: 'no_label',
      lock: '证据少于 3 类时，不更新长期画像，只生成今晚行动。',
      release: '补齐第一步、错因、隔日回访三类证据。'
    },
    {
      id: 'no_load_increase',
      lock: '没有连续两天稳定复述时，不增加题量。',
      release: '连续两次能说清第一步和错因。'
    },
    {
      id: 'no_public_ranking',
      lock: '任何分享都不带分数、排名、原题和完整对话。',
      release: '只允许分享行动建议、回访时间和证据缺口。'
    },
    {
      id: 'no_auto_teacher_claim',
      lock: 'AI 报告不替代老师判断。',
      release: '需要老师沟通时，只输出证据包和问题清单。'
    }
  ];
  return {
    id: 'portrait_evidence_maturity_system',
    title: '长期画像证据成熟度',
    maturityLevel,
    maturityScore,
    summary: `${maturityLevel}：当前 ${readyEvidence} 类证据 ready，${weakEvidence} 类证据待补，${metThresholds} 个决策阈值已满足。`,
    maturityLanes,
    decisionLocks,
    updateGateMirror: updateGates.slice(0, 4).map((gate) => ({
      id: gate.id,
      label: gate.label,
      rule: gate.rule,
      evidence: Array.isArray(gate.evidence) ? gate.evidence.join(' / ') : ''
    })),
    parentAction: maturityScore >= 76
      ? '家长可以做一次周复盘，但仍只看证据，不看排名。'
      : maturityScore >= 48
        ? primaryAction
        : '先补一条孩子自己的第一步，再生成判断。',
    shareBoundary: '成熟度只分享证据层级、行动建议和待补证据；不分享原题、答案、分数、排名或完整对话。',
    evidenceRequired: ['maturity_lanes', 'decision_locks', 'update_gate_mirror', 'parent_action', 'safe_share_boundary']
  };
}

function buildCrossWeekTrendBoard(parts = {}, matrix = [], longitudinalTimeline = {}, portraitEvidenceMaturity = {}, questionBankRecallReportBridge = {}) {
  const diagnosis = Array.isArray(matrix) ? matrix : [];
  const primary = diagnosis.find((item) => String(item.status || '').indexOf('支持') >= 0) || diagnosis[0] || {};
  const subject = primary.subject || '当前学科';
  const cause = primary.mainCause || '第一步不清';
  const timeline = Array.isArray(longitudinalTimeline.timeline) ? longitudinalTimeline.timeline : [];
  const maturityLevel = portraitEvidenceMaturity.maturityLevel || '先补证据';
  const workoutReady = questionBankRecallReportBridge && questionBankRecallReportBridge.status === 'ready';
  const trendRows = [
    {
      id: 'week_0',
      label: '本周',
      signal: `${subject} 是否能说出第一步`,
      evidence: 'child_first_step',
      decision: `只处理「${cause}」，不加题量。`,
      confidence: timeline.length >= 2 ? '可观察' : '待补证据'
    },
    {
      id: 'week_1',
      label: '下周',
      signal: '同错因是否复现',
      evidence: 'wrong_cause_replay + next_day_revisit',
      decision: workoutReady ? '用题库回忆卡做 1 次近迁移。' : '先补 1 张错因卡和 1 次明天回访。',
      confidence: workoutReady ? '可执行' : '待补题库证据'
    },
    {
      id: 'week_2',
      label: '两周后',
      signal: '方法是否跨周稳定',
      evidence: 'two_week_stability_check',
      decision: maturityLevel === '可进入周画像' ? '可更新长期画像候选。' : '继续观察，不贴长期标签。',
      confidence: maturityLevel
    }
  ];
  return {
    id: 'cross_week_trend_board',
    title: '跨周趋势板',
    subject,
    cause,
    summary: `把 ${subject} 的「${cause}」从今晚、下周到两周后连成趋势，不按单次分数下结论。`,
    trendRows,
    updateRule: '只有第一步、错因复述、明天回访、第 7 天小变式同时出现，才更新长期画像候选。',
    regressionRule: '同错因连续 2 次失败或隔天忘记，立即从趋势判断退回第一步小黑板。',
    parentLine: '家长只看趋势是否稳定，不看排名、不比较同学。',
    shareBoundary: '趋势板只分享趋势问题、下一步动作和证据缺口；不分享原题、答案、分数、排名或完整对话。',
    evidenceRequired: ['child_first_step', 'wrong_cause_replay', 'next_day_revisit', 'day7_variant', 'two_week_stability_check']
  };
}

function buildHomeSchoolCollaborationDigest(parts = {}, matrix = [], classroomDecisionBoard = {}, familyDecisionMemo = {}, crossWeekTrendBoard = {}) {
  const diagnosis = Array.isArray(matrix) ? matrix : [];
  const primary = diagnosis.find((item) => String(item.status || '').indexOf('支持') >= 0) || diagnosis[0] || {};
  const subject = primary.subject || (crossWeekTrendBoard && crossWeekTrendBoard.subject) || '当前学科';
  const cause = primary.mainCause || (crossWeekTrendBoard && crossWeekTrendBoard.cause) || '第一步不清';
  const classroomPacket = Array.isArray(classroomDecisionBoard.classroomEvidencePacket)
    ? classroomDecisionBoard.classroomEvidencePacket
    : [`${subject} 第一脚记录`, `${cause} 重复次数`, '同类题次日回访'];
  const familyEvidence = Array.isArray(familyDecisionMemo.evidenceChecklist)
    ? familyDecisionMemo.evidenceChecklist.slice(0, 4)
    : ['孩子自己的第一步', '错因卡', '明天回访'];
  return {
    id: 'home_school_collaboration_digest',
    title: '家校协同摘要',
    subject,
    cause,
    teacherQuestion: `老师侧只问：${subject} 这类题，孩子是在审题、第一步、错因复现还是迁移上卡住？`,
    parentQuestion: familyDecisionMemo.parentMeetingScript && familyDecisionMemo.parentMeetingScript[0]
      ? familyDecisionMemo.parentMeetingScript[0]
      : '家长侧只问：这一步你准备先看哪里？',
    evidencePacket: classroomPacket.concat(familyEvidence).slice(0, 6),
    suggestedMessage: `老师您好，我们这周只观察 ${subject} 的「${cause}」。孩子能说出第一步时状态更稳；如果需要沟通，我们只带第一步记录、错因重复次数和第 7 天回访结果。`,
    teacherDo: [
      '只看同类题启动动作，不按一次错题定性。',
      '优先确认孩子卡在题意、第一步、错因还是迁移。',
      '建议给 1 个同类小变式，不额外加题海。'
    ],
    parentDo: [
      '只问一句第一步，不讲完整答案。',
      '记录孩子原话和错因，不做情绪评价。',
      '明天回访同一张卡，第 7 天再看迁移。'
    ],
    doNotShare: ['原题照片', '完整答案', '完整对话', '分数', '排名', '孩子姓名', '家长联系方式', '孩子隐私评价'],
    handoffCadence: [
      { id: 'tonight', label: '今晚', action: '家庭记录第一步和错因。' },
      { id: 'tomorrow', label: '明天', action: '家庭回访同一错因。' },
      { id: 'day7', label: '第 7 天', action: '如仍反复，再把证据包带给老师沟通。' }
    ],
    shareBoundary: '家校协同只传证据包和问题清单，不传原题、答案、分数、排名、完整对话、孩子姓名或家长联系方式。',
    evidenceRequired: ['classroom_evidence_packet', 'family_evidence_checklist', 'teacher_question', 'handoff_cadence', 'safe_share_boundary']
  };
}

function buildHomeSchoolConferenceKit(parts = {}, matrix = [], homeSchoolCollaborationDigest = {}, crossWeekTrendBoard = {}, parentDecisionTrustSystem = {}) {
  const diagnosis = Array.isArray(matrix) ? matrix : [];
  const primary = diagnosis[0] || {};
  const subject = primary.subject || homeSchoolCollaborationDigest.subject || crossWeekTrendBoard.subject || '当前学科';
  const cause = primary.mainCause || homeSchoolCollaborationDigest.cause || crossWeekTrendBoard.cause || '第一步不清';
  const trustLevel = parentDecisionTrustSystem.level || '证据继续收集';
  const blockedFields = ['original_question', 'full_answer', 'full_dialogue', 'score', 'ranking', 'private_comment', 'photo', 'child_name', 'parent_phone', 'parent_wechat', 'contact_info'];
  return {
    id: 'home_school_conference_kit',
    title: '家校沟通证据包',
    subject,
    cause,
    localDeterministic: true,
    teacherQuestions: [
      {
        id: 'locate_breakpoint',
        question: `${subject} 这类题，孩子主要卡在读题、第一步、错因复现还是迁移？`,
        evidenceNeeded: 'child_first_step + wrong_cause_replay',
        blockedField: 'full_answer'
      },
      {
        id: 'observe_start',
        question: `课堂上遇到 ${cause} 时，孩子能否先说出自己要看的量或关键词？`,
        evidenceNeeded: 'classroom_start_observation',
        blockedField: 'score'
      },
      {
        id: 'variant_check',
        question: '如果换一个同类小变式，孩子是方法迁移失败，还是只是计算/书写慢？',
        evidenceNeeded: 'day7_variant_result',
        blockedField: 'original_question'
      },
      {
        id: 'support_level',
        question: '老师建议家庭这周只做哪一个最小动作，不额外加题海？',
        evidenceNeeded: 'teacher_minimum_action',
        blockedField: 'ranking'
      }
    ],
    classroomObservationRequest: [
      {
        id: 'first_step_voice',
        observe: '请观察孩子是否能在动笔前说出第一步。',
        why: '这是区分不会做和启动慢的关键证据。',
        parentDoesNotNeed: '不需要老师批改完整答案。'
      },
      {
        id: 'wrong_cause_repeat',
        observe: `请看 ${cause} 是否连续出现在同类题。`,
        why: '重复错因比单次分数更能决定家庭干预方式。',
        parentDoesNotNeed: '不需要同学对比或排名。'
      },
      {
        id: 'variant_transfer',
        observe: '请给一个同类小变式，看孩子是否能迁移同一第一步。',
        why: '迁移通过后才进入长期画像，未通过则回到小黑板。',
        parentDoesNotNeed: '不需要增加整套练习。'
      }
    ],
    parentHomeObservationLog: [
      {
        id: 'tonight_first_step',
        log: '今晚只记录孩子原话里的第一步。',
        proof: 'child_first_step',
        route: '/pages/tutor/tutor'
      },
      {
        id: 'tomorrow_revisit',
        log: '明天只回访同一个错因，不换新目标。',
        proof: 'next_day_revisit',
        route: '/pages/review/review'
      },
      {
        id: 'day7_variant',
        log: '第 7 天只看一个小变式能否迁移。',
        proof: 'day7_variant',
        route: '/pages/arcade/arcade'
      }
    ],
    sevenDayTeacherFeedbackLoop: [
      { day: 1, action: '家庭记录第一步和错因，不联系老师下结论。', evidence: 'child_first_step', releaseGate: 'local_only' },
      { day: 2, action: '完成一次同错因回访，确认是不是偶发。', evidence: 'next_day_revisit', releaseGate: 'local_only' },
      { day: 4, action: '如果同错因再次出现，准备课堂观察请求。', evidence: 'wrong_cause_repeat', releaseGate: 'prepare_teacher_question' },
      { day: 7, action: '用证据包向老师问一个具体问题，不传原题答案。', evidence: 'day7_variant_result', releaseGate: 'safe_teacher_handoff' }
    ],
    localReleaseGate: {
      status: trustLevel,
      requiredEvidence: ['child_first_step', 'wrong_cause_replay', 'next_day_revisit', 'day7_variant_result'],
      blockedFields,
      rule: '只有连续证据显示同一错因反复，才生成家校沟通问题；AI 不决定是否联系老师。'
    },
    shareBoundary: '只分享观察问题、家庭动作和证据缺口；不分享原题、完整答案、完整对话、分数、排名、照片或隐私评价。',
    aiBoundary: 'AI 可以改写家长措辞，但不得替代老师判断、不得生成完整答案、不得决定画像升级。',
    evidenceRequired: ['teacher_question_list', 'classroom_observation_request', 'parent_home_log', 'seven_day_feedback_loop', 'local_release_gate', 'privacy_blocked_fields']
  };
}

function buildSocraticMemoryReportBridge(input = {}, parentDecisionTrust = {}, portraitConfidence = {}) {
  const gameEvidence = input.gameEvidence || {};
  const highFrequencyLoop = input.highFrequencyPracticeLoop || gameEvidence.highFrequencyPracticeLoop || {};
  const bridge = input.socraticQualityMemoryBridge || highFrequencyLoop.socraticQualityMemoryBridge || {};
  const actions = Array.isArray(bridge.memoryActions) ? bridge.memoryActions : [];
  const scenarioCount = Number(bridge.scenarioCount || 0);
  const evidenceRequired = Array.isArray(bridge.evidenceRequired) ? bridge.evidenceRequired : [];
  const trustDeck = Array.isArray(parentDecisionTrust.decisionDeck) ? parentDecisionTrust.decisionDeck : [];
  const confidenceLedger = Array.isArray(portraitConfidence.evidenceLedger) ? portraitConfidence.evidenceLedger : [];
  const hasLiveBridge = scenarioCount > 0 && actions.length > 0;
  const readyEvidence = confidenceLedger.filter((item) => item.status === 'ready').length;
  const canUpdatePortrait = hasLiveBridge && readyEvidence >= 2 && trustDeck.some((item) => item.id === 'portrait' && String(item.verdict || '').indexOf('先不要') < 0);
  const primaryAction = actions.find((item) => item.id === 'wrong_axis') || actions[0] || {};
  return {
    id: 'socratic_memory_report_bridge',
    title: '点拨质量到长期画像',
    status: hasLiveBridge ? 'ready' : 'waiting_game_evidence',
    scenarioCount,
    actionCount: actions.length,
    summary: hasLiveBridge
      ? `已有 ${scenarioCount} 个点拨质量场景接入游戏复习，家长报告可以用它判断是否继续观察、降级或进入长期画像。`
      : '还缺一次带点拨质量证据的游戏复习，暂不把单次表现写入长期画像。',
    primaryActionLine: primaryAction.title
      ? `${primaryAction.title}：${primaryAction.memoryAction}`
      : '先完成一次点拨后的高频回忆，再进入家长报告判断。',
    reportDecisionLine: canUpdatePortrait
      ? '可临时更新长期画像，但仍需明天和第 7 天复核。'
      : '暂不更新长期画像，只把今晚动作写入观察记录。',
    noIncreaseRule: bridge.xpGate || '没有第一步、错因回放或次日回访证据，不增加题量。',
    parentProofLine: bridge.parentLine || '家长只看孩子是否说出第一步、是否完成回访。',
    shareBoundary: bridge.privacyBoundary || '不带原题照片、完整对话、分数、排名、私密评价或原始答案。',
    reportActions: actions.slice(0, 4).map((item) => ({
      id: item.id,
      label: item.title,
      action: item.memoryAction,
      evidence: item.evidence,
      route: item.route || '/pages/review/review'
    })),
    evidenceRequired: ['socratic_quality_memory_bridge', 'parent_decision_trust', 'portrait_confidence_ledger'].concat(evidenceRequired).slice(0, 8)
  };
}

function buildQuestionBankDecisionBridge(input = {}, parentDecisionTrust = {}, portraitConfidence = {}) {
  const gameEvidence = input.gameEvidence || {};
  const highFrequencyLoop = input.highFrequencyPracticeLoop || gameEvidence.highFrequencyPracticeLoop || {};
  const bridge = input.questionBankMemoryBridge || highFrequencyLoop.questionBankMemoryBridge || {};
  const activeDeck = Array.isArray(bridge.activeDeck) ? bridge.activeDeck : [];
  const reviewWindows = Array.isArray(bridge.reviewWindows) ? bridge.reviewWindows : [];
  const questionCardCount = Number(bridge.questionCardCount || 0);
  const trustScore = Number(parentDecisionTrust.score || 0);
  const confidenceScore = Number(portraitConfidence.evidenceScore || 0);
  const canUseForDecision = bridge.status === 'ready' && activeDeck.length >= 3 && trustScore >= 45;
  return {
    id: 'question_bank_decision_bridge',
    title: '题型题库到家长决策',
    status: bridge.status || 'waiting_question_bank',
    questionCardCount,
    activeCardCount: Number(bridge.activeCardCount || activeDeck.length || 0),
    masteryGateCount: Number(bridge.masteryGateCount || 0),
    progressionStageCount: Number(bridge.progressionStageCount || 0),
    summary: canUseForDecision
      ? `题库已有 ${questionCardCount} 张题型卡，当前 ${activeDeck.length} 张进入高频记忆训练；家长可以按掌握门槛安排明天回访。`
      : '题型题库证据还不足，报告只能给今晚观察建议，不升级长期画像。',
    decisionLine: canUseForDecision
      ? '今晚只追一个题型掌握门槛；明天回访通过后，再决定是否进入长期画像。'
      : '先补足第一步、错因复述和次日回访证据，再做长期判断。',
    parentActionLine: bridge.parentDecisionLine || '家长只看题型掌握门槛、错因是否复现和明天回访，不看分数排行。',
    xpGate: bridge.xpGate || '只刷数量不加分，必须留下第一步和回访证据。',
    reportLine: bridge.reportLine || '',
    privacyBoundary: bridge.privacyBoundary || '不分享原题照片、完整答案、分数、排名和孩子私密评价。',
    activeDeck: activeDeck.slice(0, 4).map((item) => ({
      id: item.id,
      label: item.label,
      firstStep: item.firstStep,
      masteryGate: item.masteryGate,
      parentCheck: item.parentCheck,
      nextDayRevisit: item.nextDayRevisit
    })),
    reviewWindows,
    evidenceRequired: ['question_bank_memory_bridge', 'mastery_gate', 'parent_decision_trust', 'portrait_confidence'].concat(Array.isArray(bridge.evidenceRequired) ? bridge.evidenceRequired : []).slice(0, 9),
    confidenceLine: `家长决策可信分 ${trustScore}，画像证据分 ${confidenceScore}；不足时只做观察，不做结论。`
  };
}

function buildQuestionBankRecallReportBridge(input = {}, parentDecisionTrust = {}, portraitConfidence = {}) {
  const gameEvidence = input.gameEvidence || {};
  const highFrequencyLoop = input.highFrequencyPracticeLoop || gameEvidence.highFrequencyPracticeLoop || {};
  const workout = input.questionBankRecallWorkout || highFrequencyLoop.questionBankRecallWorkout || {};
  const workoutCards = Array.isArray(workout.workoutCards) ? workout.workoutCards : [];
  const phases = Array.isArray(workout.phases) ? workout.phases : [];
  const greenWordClozeProtocol = workout.greenWordClozeProtocol || highFrequencyLoop.greenWordClozeProtocol || gameEvidence.greenWordClozeProtocol || {};
  const greenWordCards = Array.isArray(greenWordClozeProtocol.clozeCards) ? greenWordClozeProtocol.clozeCards : [];
  const trustScore = Number(parentDecisionTrust.score || 0);
  const confidenceScore = Number(portraitConfidence.evidenceScore || 0);
  const hasWorkout = workoutCards.length >= 3 && phases.length >= 4;
  const canFeedPortrait = hasWorkout && trustScore >= 45 && confidenceScore >= 70;
  return {
    id: 'question_bank_recall_report_bridge',
    title: '题库回忆训练到长期画像',
    status: hasWorkout ? 'ready' : 'waiting_recall_workout',
    mode: workout.mode || '',
    workoutCardCount: workoutCards.length,
    phaseCount: phases.length,
    summary: hasWorkout
      ? `题库回忆训练已形成 ${workoutCards.length} 张训练卡和 ${phases.length} 个训练阶段，报告可用它判断明天回访、错因重放和第 7 天小变式。`
      : '还缺一轮完整题库回忆训练，报告暂不把单次游戏结果写入长期画像。',
    portraitDecisionLine: canFeedPortrait
      ? '可以作为长期画像的候选证据，但仍必须经过明天回访和第 7 天复核。'
      : '暂不更新长期画像，只进入家长行动记录和下次回访清单。',
    parentActionLine: workout.parentDecisionLine || '家长只看训练阶段、回访窗口和掌握门槛，不看分数排名。',
    noCramRule: workout.noCramRule || '单次正确不升级长期画像；必须有明天回访和第 7 天小变式。',
    shareBoundary: workout.shareBoundary || '分享只带训练主题、第一步和回访时间，不带原题、答案、分数、排名或完整对话。',
    greenWordClozeProtocol,
    greenWordLine: greenWordClozeProtocol.status === 'ready'
      ? `已把 ${greenWordCards.length} 张题型卡改成挖空关键词模式，先补关键词再回忆第一步。`
      : '暂时还没有足够的挖空题卡，先回到题型卡和第一步点拨。',
    greenWordModes: Array.isArray(greenWordClozeProtocol.progressiveQuizModes)
      ? greenWordClozeProtocol.progressiveQuizModes.slice(0, 4)
      : [],
    greenWordCards: greenWordCards.slice(0, 4).map((item) => ({
      id: item.id,
      label: item.label,
      targetKeyword: item.targetKeyword,
      clozePrompt: item.clozePrompt,
      nextMode: item.nextMode,
      parentCheck: item.parentCheck
    })),
    intensityLine: workout.intensityLine || '',
    returnWindowLine: workout.returnWindowLine || '',
    workoutCards: workoutCards.slice(0, 4).map((item) => ({
      id: item.id,
      label: item.label,
      action: item.action,
      proof: item.proof,
      route: item.route || '/pages/arcade/arcade'
    })),
    phases: phases.slice(0, 5).map((item) => ({
      id: item.id,
      label: item.label,
      rule: item.rule
    })),
    evidenceRequired: ['question_bank_recall_workout', 'green_word_cloze_protocol', 'workout_cards', 'recall_phases', 'parent_decision_trust', 'portrait_confidence'].concat(Array.isArray(workout.evidenceRequired) ? workout.evidenceRequired : []).slice(0, 10)
  };
}

function buildPortraitDecisionReleaseSystem(input = {}, parentDecisionTrust = {}, portraitConfidence = {}, portraitEvidenceMaturity = {}, questionBankRecallReportBridge = {}) {
  const gameEvidence = input.gameEvidence || {};
  const highFrequencyLoop = input.highFrequencyPracticeLoop || gameEvidence.highFrequencyPracticeLoop || {};
  const scheduler = input.adaptiveRecallScheduler || highFrequencyLoop.adaptiveRecallScheduler || {};
  const schedulerBoxes = Array.isArray(scheduler.schedulerBoxes) ? scheduler.schedulerBoxes : [];
  const reviewQueue = Array.isArray(scheduler.reviewQueue) ? scheduler.reviewQueue : [];
  const unlockRules = Array.isArray(scheduler.unlockRules) ? scheduler.unlockRules : [];
  const leechRules = Array.isArray(scheduler.leechRules) ? scheduler.leechRules : [];
  const trustScore = Number(parentDecisionTrust.score || 0);
  const evidenceScore = Number(portraitConfidence.evidenceScore || 0);
  const maturityScore = Number(portraitEvidenceMaturity.maturityScore || 0);
  const hasTomorrow = reviewQueue.some((item) => String(item.releaseEvidence || '').indexOf('next_day_revisit') >= 0);
  const hasDay7 = reviewQueue.some((item) => String(item.releaseEvidence || '').indexOf('long_term_portrait_gate') >= 0);
  const recallReady = questionBankRecallReportBridge.status === 'ready' && Number(questionBankRecallReportBridge.workoutCardCount || 0) >= 3;
  const releaseScore = Math.max(0, Math.min(100,
    Math.round(trustScore * 0.32 + Math.min(evidenceScore, 140) * 0.22 + maturityScore * 0.26 + (hasTomorrow ? 10 : 0) + (hasDay7 ? 10 : 0))
  ));
  const releaseLevel = releaseScore >= 75 && hasTomorrow && hasDay7
    ? 'portrait_candidate'
    : releaseScore >= 50 && hasTomorrow
      ? 'action_only'
      : 'collect_more_evidence';
  return {
    id: 'portrait_decision_release_system',
    title: '长期画像放行系统',
    releaseLevel,
    releaseScore,
    summary: releaseLevel === 'portrait_candidate'
      ? '当前可以作为长期画像候选证据，但仍按第 7 天复核后再写入稳定结论。'
      : releaseLevel === 'action_only'
        ? '当前只能支持今晚和明天的家庭行动，不支持给孩子贴长期标签。'
        : '当前证据不足，只能继续收集第一步、错因和回访证据。',
    releaseLanes: [
      {
        id: 'tonight_action',
        label: '今晚行动',
        status: trustScore >= 30 ? 'released' : 'blocked',
        releaseRule: '有明确第一步或错因，就允许做一个低压动作。',
        blockedRule: '没有孩子自己的第一步，不给行动结论。',
        evidence: 'child_first_step'
      },
      {
        id: 'tomorrow_revisit',
        label: '明天回访',
        status: hasTomorrow ? 'released' : 'blocked',
        releaseRule: '调度器里出现明天回访卡，才允许判断是否转身还记得。',
        blockedRule: '没有隔天回访，不判断掌握。',
        evidence: 'next_day_revisit'
      },
      {
        id: 'day3_transfer',
        label: '第3天变式',
        status: releaseScore >= 55 && recallReady ? 'candidate' : 'blocked',
        releaseRule: '错因回放稳定后，才开放小变式。',
        blockedRule: '错因急救未完成，不加新题量。',
        evidence: 'near_transfer_attempt'
      },
      {
        id: 'day7_portrait',
        label: '第7天画像',
        status: releaseLevel === 'portrait_candidate' ? 'candidate' : 'blocked',
        releaseRule: '第7天仍能迁移，才写入长期画像候选结论。',
        blockedRule: '少于7天证据，只能作为家庭行动记录。',
        evidence: 'long_term_portrait_gate'
      }
    ],
    schedulerBoxes,
    reviewQueue,
    releaseLocks: [
      '没有明天回访，不写入长期画像。',
      '没有第 7 天小变式，不把单次正确当稳定能力。',
      '同一错因仍在急救盒时，不增加题量。',
      '家长报告不展示完整对话、原题照片、分数排名或私密评价。'
    ],
    parentDecisionLine: releaseLevel === 'portrait_candidate'
      ? '家长可以把它当作画像候选证据，但要等第 7 天复核后再稳定下来。'
      : releaseLevel === 'action_only'
        ? '家长今晚只做一个动作：问第一步，明天回访，不下长期判断。'
        : '家长先收证据，不评价孩子能力。',
    actionQueue: [
      { id: 'ask_first_step', label: '先问第一步', route: '/pages/tutor/tutor', evidence: 'child_first_step' },
      { id: 'run_revisit', label: '明天回访', route: '/pages/review/review', evidence: 'next_day_revisit' },
      { id: 'play_memory', label: '高频回忆', route: '/pages/arcade/arcade', evidence: 'adaptive_recall_scheduler' },
      { id: 'review_portrait', label: '第7天再看画像', route: '/pages/profile/profile', evidence: 'long_term_portrait_gate' }
    ],
    xpReleaseLine: scheduler.xpGate || 'XP 只能跟随回访证据释放，不作为分数排名。',
    shareBoundary: scheduler.shareBoundary || '分享只带行动、回访窗口和证据缺口，不带原题照片、完整答案、完整对话、分数或排名。',
    evidenceRequired: ['parent_decision_trust', 'portrait_confidence', 'portrait_evidence_maturity', 'adaptive_recall_scheduler', 'next_day_revisit', 'long_term_portrait_gate', 'safe_share_boundary'].concat(unlockRules, leechRules).slice(0, 12)
  };
}

function buildReportEvidenceReleaseGate(input = {}, portraitDecisionReleaseSystem = {}, crossWeekTrendBoard = {}, homeSchoolCollaborationDigest = {}, homeSchoolConferenceKit = {}, portraitConfidence = {}, portraitEvidenceMaturity = {}) {
  const releaseLanes = Array.isArray(portraitDecisionReleaseSystem.releaseLanes) ? portraitDecisionReleaseSystem.releaseLanes : [];
  const day7Lane = releaseLanes.find((item) => item.id === 'day7_portrait') || {};
  const tomorrowLane = releaseLanes.find((item) => item.id === 'tomorrow_revisit') || {};
  const trendRows = Array.isArray(crossWeekTrendBoard.trendRows) ? crossWeekTrendBoard.trendRows : [];
  const twoWeekRow = trendRows.find((item) => item.id === 'week_2') || {};
  const blockedFields = Array.from(new Set([
    'original_question',
    'photo',
    'full_answer',
    'full_dialogue',
    'score',
    'ranking',
    'private_comment',
    'classmate_comparison',
    'child_name',
    'parent_phone',
    'parent_wechat',
    'contact_info'
  ].concat(
    Array.isArray(homeSchoolConferenceKit.localReleaseGate && homeSchoolConferenceKit.localReleaseGate.blockedFields)
      ? homeSchoolConferenceKit.localReleaseGate.blockedFields
      : []
  )));
  const allowedFields = [
    'subject',
    'wrong_cause_label',
    'first_step_observation',
    'next_day_revisit_status',
    'day7_variant_status',
    'two_week_stability_status',
    'parent_question',
    'teacher_observation_request'
  ];
  const day7Released = day7Lane.status === 'candidate' || day7Lane.status === 'released';
  const tomorrowReleased = tomorrowLane.status === 'released';
  const behaviorSignals = input.behaviorSignals || {};
  const spacedReviewEvidenceLedger = input.spacedReviewEvidenceLedger || {};
  const ledgerEvidence = spacedReviewEvidenceLedger.evidence || spacedReviewEvidenceLedger.actualLongitudinalEvidence || {};
  const portraitLongitudinalEvidence = portraitConfidence.longitudinalEvidence || {};
  const actualLongitudinalEvidence = {
    nextDayRevisitCount: Number(
      behaviorSignals.nextDayRevisitCount
      || ledgerEvidence.nextDayRevisitCount
      || portraitLongitudinalEvidence.nextDayRevisitCount
      || (behaviorSignals.nextDayRevisit || ledgerEvidence.next_day_revisit_status === 'passed' ? 1 : 0)
      || 0
    ),
    day7VariantReady: !!(
      behaviorSignals.day7VariantReady
      || behaviorSignals.day7VariantResult
      || behaviorSignals.day7VariantStatus === 'passed'
      || ledgerEvidence.day7VariantReady
      || ledgerEvidence.day7_variant_status === 'passed'
      || portraitLongitudinalEvidence.day7VariantReady
    ),
    twoWeekStabilityReady: !!(
      behaviorSignals.twoWeekStabilityReady
      || behaviorSignals.twoWeekStabilityCheck
      || behaviorSignals.twoWeekStabilityStatus === 'stable'
      || ledgerEvidence.twoWeekStabilityReady
      || ledgerEvidence.two_week_stability_status === 'stable'
      || portraitLongitudinalEvidence.twoWeekStabilityReady
    ),
    sameWrongCauseRecurrence: Number(
      behaviorSignals.sameWrongCauseRecurrence
      || ledgerEvidence.sameWrongCauseRecurrence
      || portraitLongitudinalEvidence.sameWrongCauseRecurrence
      || 0
    ),
    source: spacedReviewEvidenceLedger.id || 'behavior_signals_and_portrait_confidence'
  };
  const day7ReleasedByActualEvidence = day7Released || actualLongitudinalEvidence.day7VariantReady;
  const tomorrowReleasedByActualEvidence = tomorrowReleased || actualLongitudinalEvidence.nextDayRevisitCount > 0;
  const twoWeekReady = actualLongitudinalEvidence.twoWeekStabilityReady
    || String(twoWeekRow.decision || '').indexOf('更新长期画像候选') >= 0
    || String(twoWeekRow.confidence || '').indexOf('可进入周画像') >= 0;
  const releaseDecision = day7ReleasedByActualEvidence && twoWeekReady
    ? 'home_school_safe_handoff'
    : tomorrowReleasedByActualEvidence
      ? 'tonight_action_only'
      : 'collect_more_evidence';
  return {
    id: 'report_evidence_release_gate',
    title: '报告证据放行闸',
    localDeterministic: true,
    releaseDecision,
    summary: releaseDecision === 'home_school_safe_handoff'
      ? '证据可以进入家校安全交接，但仍只传观察问题和行动线索，不传原题答案。'
      : releaseDecision === 'tonight_action_only'
        ? '证据只支持今晚行动和明天回访，不能生成长期画像结论。'
        : '证据不足，报告只保留观察记录，不给能力定性。',
    singleSampleLock: {
      status: 'locked',
      rule: '单次题目、单次正确或单次卡住，都不能放行长期画像、跨周趋势或老师结论。',
      blockedRelease: ['long_term_portrait', 'cross_week_trend', 'teacher_handoff'],
      allowedRelease: ['tonight_action', 'first_step_prompt', 'parent_observation']
    },
    day7Gate: {
      status: day7ReleasedByActualEvidence ? 'candidate' : 'blocked',
      rule: '第 7 天小变式仍能迁移，才允许进入长期画像候选。',
      requiredEvidence: ['next_day_revisit', 'day7_variant_result', 'long_term_portrait_gate'],
      currentEvidence: day7Lane.evidence || (actualLongitudinalEvidence.day7VariantReady ? 'behaviorSignals.day7VariantResult' : '')
    },
    twoWeekStabilityGate: {
      status: twoWeekReady ? 'candidate' : 'blocked',
      rule: '连续两周同一方法有效，才允许把候选画像升级为稳定策略。',
      requiredEvidence: ['two_week_stability_check', 'same_wrong_cause_recurrence', 'method_transfer_success'],
      currentDecision: twoWeekRow.decision || ''
    },
    homeSchoolSafeHandoff: {
      status: releaseDecision === 'home_school_safe_handoff' ? 'ready' : 'locked',
      allowedFields,
      blockedFields,
      teacherQuestion: homeSchoolCollaborationDigest.teacherQuestion || '',
      parentQuestion: homeSchoolCollaborationDigest.parentQuestion || '',
      handoffRule: '家校交接只传证据类型、观察问题和下一步动作，不传原题、答案、照片、分数、排名或完整对话。'
    },
    confidenceFloor: {
      portraitConfidenceScore: Number(portraitConfidence.evidenceScore || 0),
      maturityScore: Number(portraitEvidenceMaturity.maturityScore || 0),
      releaseScore: Number(portraitDecisionReleaseSystem.releaseScore || 0),
      rule: '分数只决定是否继续观察，不替代家长、老师和孩子的真实反馈。'
    },
    actualLongitudinalEvidence,
    portraitStage: portraitConfidence.portraitStage || '',
    portraitStageLabel: portraitConfidence.portraitStageLabel || '',
    portraitNextEvidenceAction: portraitConfidence.portraitNextEvidenceAction || '',
    aiBoundary: 'AI 只能改写解释和家校措辞；单题锁、7 天门槛、两周稳定、分享字段和家校放行全部由本地代码决定。',
    evidenceRequired: ['single_sample_lock', 'next_day_revisit', 'day7_variant_result', 'two_week_stability_check', 'safe_handoff_allowed_fields', 'unsafe_handoff_blocked_fields', 'ai_expression_only']
  };
}

function sourceTextHas(source = {}, pattern) {
  return pattern.test([
    source.id,
    source.type,
    source.label,
    source.text,
    source.status,
    source.nextEvidenceUnlockPlan
  ].filter(Boolean).join('\n'));
}

function buildLaneRequiredNextEvidence(lane = {}, source = {}) {
  const explicit = Array.isArray(source.requiredNextEvidence) ? source.requiredNextEvidence.filter(Boolean) : [];
  const sourceId = source.id || lane.id || 'source_evidence';
  if (explicit.length) {
    return explicit.slice(0, 4).map((item, index) => ({
      id: item.id || `${sourceId}_next_${index + 1}`,
      label: item.label || item.title || item.id || `next_evidence_${index + 1}`,
      reason: item.reason || item.unlocks || lane.nextAction || '',
      unlocks: item.unlocks || item.reason || lane.canProduce || '',
      route: item.route || '/pages/upload/upload'
    }));
  }
  return (Array.isArray(lane.missing) ? lane.missing : []).slice(0, 3).map((label, index) => ({
    id: `${lane.id || 'lane'}_missing_${index + 1}`,
    label,
    reason: lane.nextAction || '',
    unlocks: lane.canProduce || '',
    route: '/pages/upload/upload'
  }));
}

function buildSourceEvidenceLedger(input = {}, parts = {}, familyDecisionMemo = {}, reportEvidenceReleaseGate = {}) {
  const sources = Array.isArray(parts.reportSources) ? parts.reportSources : [];
  const allText = [
    input.sourceText || '',
    input.scoreText || '',
    input.materialType || '',
    input.sourceType || ''
  ].concat(sources.map((source) => `${source.type || ''}\n${source.label || ''}\n${source.text || ''}`)).join('\n');
  const lanes = [
    {
      id: 'parent_report',
      label: '家长报告',
      pattern: /家长|家庭|复盘|观察|情绪|拖拉|沟通|作业习惯|专注|睡眠|兴趣/,
      localFields: ['家庭观察', '家长期望', '今晚动作', '明天回访'],
      canProduce: '家庭决策书、今晚一句话、7 天行动板',
      missing: ['孩子自己的第一步', '明天回访结果'],
      nextAction: '先用一处真实作业验证家长观察。',
      aiAllowed: '改写成低压沟通话术',
      aiBlocked: '亲子关系定性、孩子能力定性'
    },
    {
      id: 'talent_assessment',
      label: '天赋/学习偏好测评',
      pattern: /天赋|测评|学习类型|学习风格|视觉型|听觉型|动觉型|优势|性格|MBTI|多元智能|注意力/,
      localFields: ['学习偏好候选', '方法假设', '交叉验证闸', '回访窗口'],
      canProduce: '方法建议候选：先看图、先复述、先动笔或先拆步',
      missing: ['真实作业卡点', '两次以上回访证据', '第 7 天小变式'],
      nextAction: '只把测评当候选，用错题和回访确认。',
      aiAllowed: '把测评摘要翻译成孩子听得懂的方法建议',
      aiBlocked: '天赋定性、升学结论、人格标签',
      releaseScope: 'method_candidate_only',
      portraitConfidenceWeight: 0,
      scoreRankingPolicy: 'degrade_to_unreleased_reference'
    },
    {
      id: 'school_material',
      label: '学校/老师材料',
      pattern: /老师|学校|课堂|评语|批注|作业反馈|家校|班主任|错题本|试卷讲评/,
      localFields: ['老师观察', '课堂信号', '家校问题', '安全交接'],
      canProduce: '家校沟通摘要、老师观察问题、家庭配合动作',
      missing: ['家庭观察记录', '孩子复述证据'],
      nextAction: '只带观察问题给老师，不带原题照片和排名。',
      aiAllowed: '润色家校沟通摘要',
      aiBlocked: '替老师判断、公开排名、原题照片转发'
    },
    {
      id: 'wrong_question_paper',
      label: '错题/试卷',
      pattern: /错题|试卷|周测|单元测|期中|期末|扣分|列式|阅读理解|计算|证明|实验|方程|应用题/,
      localFields: ['题型', '错因', '第一步', '明天回访', '第 7 天小变式'],
      canProduce: '错因报告、第一步小黑板、轻练习和间隔回访',
      missing: ['孩子原想法', '卡住的第一步'],
      nextAction: '抽一题做第一步，不做整张卷自动答案。',
      aiAllowed: '苏格拉底追问、小黑板话术、同错因变式表达',
      aiBlocked: '完整答案、自动判分、分数排名解释'
    },
    {
      id: 'score_sheet',
      label: '成绩单/周测',
      pattern: /成绩|分数|周测|单元测|期中|期末|测验|考试|数学\s*\d+|语文\s*\d+|英语\s*\d+/,
      localFields: ['学科优先级', '趋势线索', '待验证弱项', '家长私密查看'],
      canProduce: '学科优先级和下一证据队列',
      missing: ['对应错题样本', '孩子第一步', '隔天回访结果'],
      nextAction: '只用成绩决定先看哪一科，不用来排名、刺激或承诺提分。',
      aiAllowed: '把分数翻译成家长能执行的优先级建议',
      aiBlocked: '公开排名、保分承诺、天赋定性、羞辱性比较'
    }
  ].map((lane) => {
    const matchedSource = sources.find((source) => sourceTextHas(source, lane.pattern));
    const sourceHit = !!matchedSource;
    const textHit = lane.pattern.test(allText);
    const collected = sourceHit || textHit;
    const requiredNextEvidence = buildLaneRequiredNextEvidence(lane, matchedSource || {});
    return Object.assign({}, lane, {
      collected,
      status: collected ? '已采集' : '待补充',
      release: lane.releaseScope === 'method_candidate_only'
        ? '只放行学习方法候选，不进入长期画像、分数排名或天赋定性'
        : collected ? '今晚行动可用，长期画像仍需回访验证' : '不生成该类结论',
      evidenceMissing: lane.missing,
      matchedSourceId: matchedSource ? matchedSource.id : '',
      nextEvidenceUnlockPlan: matchedSource ? (matchedSource.nextEvidenceUnlockPlan || '') : '',
      requiredNextEvidence,
      blockedFields: reportEvidenceReleaseGate.homeSchoolSafeHandoff
        ? reportEvidenceReleaseGate.homeSchoolSafeHandoff.blockedFields
        : ['original_question', 'photo', 'full_answer', 'score', 'ranking']
    });
  });
  const collectedCount = lanes.filter((lane) => lane.collected).length;
  const nextEvidenceQueue = lanes
    .filter((lane) => !lane.collected || lane.releaseScope === 'method_candidate_only' || (Array.isArray(lane.requiredNextEvidence) && lane.requiredNextEvidence.length))
    .reduce((acc, lane) => acc.concat((lane.requiredNextEvidence || []).map((item) => Object.assign({
      laneId: lane.id,
      laneLabel: lane.label,
      collected: lane.collected
    }, item))), [])
    .slice(0, 8);
  const safestLane = lanes.find((lane) => lane.collected && lane.id === 'wrong_question_paper')
    || lanes.find((lane) => lane.collected)
    || lanes[3];
  return {
    id: 'source_evidence_ledger',
    title: '资料到详细报告账本',
    summary: `已采集 ${collectedCount}/${lanes.length} 类资料；先生成今晚行动，长期画像必须等回访证据。`,
    collectedCount,
    totalCount: lanes.length,
    lanes,
    nextEvidenceQueue,
    nextEvidenceLine: nextEvidenceQueue.length
      ? nextEvidenceQueue.map((item) => `${item.laneId}:${item.id}`).join(' -> ')
      : '',
    safestNextAction: safestLane.nextAction,
    familyDecisionRoute: familyDecisionMemo.route || '/pages/tutor/tutor?from=source_evidence_ledger',
    localRule: '来源分类、证据缺口、报告放行、分享字段和家校交接全部由本地代码决定。',
    aiBoundary: 'AI 只做摘要、追问和表达改写；不做天赋定性、掌握结论、分数排名或完整答案。',
    evidenceRequired: ['source_type', 'child_first_step', 'wrong_cause', 'next_day_revisit', 'day7_variant_result', 'safe_handoff_fields']
  };
}

function buildFamilyDecisionCalendar(input = {}, methodCandidateCards = [], wrongPaperDiagnosisCards = [], reportEvidenceReleaseGate = {}) {
  const primaryMethod = methodCandidateCards[0] || {};
  const primaryWrong = wrongPaperDiagnosisCards[0] || {};
  const releaseStatus = reportEvidenceReleaseGate.releaseDecision || 'collect_more_evidence';
  const weeks = [
    {
      id: 'tonight',
      label: '今晚',
      parentDecision: '只判断孩子能不能说出第一步，不追加题量。',
      childEvidence: primaryMethod.tonightTry || primaryWrong.nextAction || '说出第一步和卡住原因。',
      reportAction: '只写今晚动作，不更新长期画像。',
      releaseGate: 'child_first_step'
    },
    {
      id: 'tomorrow',
      label: '明天',
      parentDecision: primaryMethod.parentQuestionTomorrow || '只问昨天那一步还能不能说出来。',
      childEvidence: primaryWrong.nextAction || primaryMethod.tonightWrongQuestionTest || '用一题真实错题验证同一方法。',
      reportAction: '生成隔天回访，不写掌握结论。',
      releaseGate: 'next_day_revisit'
    },
    {
      id: 'day7',
      label: '第7天',
      parentDecision: '换一道小变式，只看方法能否迁移。',
      childEvidence: primaryMethod.day7Evidence || '第 7 天小变式迁移结果。',
      reportAction: '有迁移证据才允许进入画像候选。',
      releaseGate: 'day7_variant_result'
    },
    {
      id: 'day30',
      label: '第30天',
      parentDecision: '只看同类卡点是否下降，不看排名和分数刺激。',
      childEvidence: '跨周错因复现次数、第一步稳定性、家校观察一致性。',
      reportAction: releaseStatus === 'home_school_safe_handoff' ? '可生成家校沟通摘要。' : '继续收集证据，暂不做长期结论。',
      releaseGate: 'two_week_stability_check'
    }
  ];
  return {
    id: 'family_decision_calendar',
    title: '家庭决策日历',
    summary: '把测评、错题和家长观察压成今晚、明天、第7天、第30天四个可验证动作。',
    status: releaseStatus,
    weeks,
    monthlyReview: {
      label: '月度复盘',
      decision: '只升级被真实作业、隔天回访、第7天变式和跨周稳定共同支持的方法候选。',
      doNotSay: ['天赋定性', '人格标签', '结果承诺', '排名比较', '整卷答案'],
      nextEvidence: ['child_first_step', 'next_day_revisit', 'day7_variant_result', 'two_week_stability_check']
    },
    localRule: '本地代码决定日历状态、证据门槛和能否更新画像；AI 只改写家长话术。'
  };
}

function buildEvidenceBasedMethodologyGuide(methodCandidateCards = [], materialLanes = [], servicePathway = {}) {
  const primaryMethod = methodCandidateCards[0] || {};
  const laneById = materialLanes.reduce((acc, lane) => {
    if (lane && lane.id) acc[lane.id] = lane;
    return acc;
  }, {});
  const hasAssessment = !!(laneById.talent_assessment && laneById.talent_assessment.collected);
  const hasWrongPaper = !!(laneById.wrong_question_paper && laneById.wrong_question_paper.collected);
  const hasParentReport = !!(laneById.parent_report && laneById.parent_report.collected);
  const serviceMode = servicePathway && servicePathway.primaryMode ? servicePathway.primaryMode : {};
  const cards = [
    {
      id: 'socratic_first_step',
      label: '苏格拉底第一步',
      principle: '先追问孩子的第一步和理由，不直接给完整答案。',
      useWhen: hasWrongPaper ? '已有真实错题、试卷或卡住表达。' : '孩子能说出一点想法，但还没有形成稳定步骤。',
      reportLine: '报告会把它写成“今晚先问哪一句”，而不是写成“孩子不会”。',
      productRoute: '/pages/tutor/tutor?from=methodology_guide',
      evidenceGate: 'child_first_step',
      sourceBasis: '1 对 1 针对性支持、元认知自我解释、Khanmigo 式不直接给答案。'
    },
    {
      id: 'feynman_retell',
      label: '费曼复述',
      principle: '让孩子用自己的话复述题意、条件和第一步，暴露卡点。',
      useWhen: primaryMethod.id && /verbal|retell/.test(primaryMethod.id) ? '当前最高候选是先复述题意。' : '阅读理解、应用题、概念题里“看过但说不清”。',
      reportLine: '报告会给家长一句低压提问：这题问什么、已知什么、第一步看哪里。',
      productRoute: '/pages/tutor/tutor?from=methodology_retell',
      evidenceGate: 'parent_one_question',
      sourceBasis: '精细加工、自我解释和元认知监控。'
    },
    {
      id: 'dual_coding_blackboard',
      label: '图文双编码/小黑板',
      principle: '把文字、数量关系或概念缺口画成一帧图，再让孩子说第一步。',
      useWhen: primaryMethod.id && /visual/.test(primaryMethod.id) ? '当前最高候选是先看图或先画关系。' : '几何、应用题、实验、长题干或条件很多时。',
      reportLine: '报告只建议“先画条件关系”，不把孩子贴成固定视觉型。',
      productRoute: '/pages/tutor/tutor?from=methodology_blackboard',
      evidenceGate: 'one_blackboard_frame',
      sourceBasis: '降低工作记忆负荷，配合自我解释验证。'
    },
    {
      id: 'elaboration_concrete_example',
      label: '解释性追问/具体例子',
      principle: '用“为什么这一步成立”“能不能举一个同类小例子”让孩子把规则说成自己的理解。',
      useWhen: '概念会背但不会用、公式套错、语文阅读答不到点、英语语法只记规则时。',
      reportLine: '报告会写成“今晚只追问一个为什么和一个小例子”，不把问题扩大成整章重学。',
      productRoute: '/pages/tutor/tutor?from=methodology_elaboration',
      evidenceGate: 'one_why_and_one_concrete_example',
      sourceBasis: '精细加工、具体例子和自我解释能帮助家长判断孩子是真懂还是只会复述。'
    },
    {
      id: 'interleaving_variant_transfer',
      label: '交错练习/小变式迁移',
      principle: '在同一错因稳定后混入一题小变式，验证孩子能否识别变化而不是背步骤。',
      useWhen: hasWrongPaper ? '已有同一错因的错题或回访记录，可以做第 7 天小变式。' : '只有测评或成绩时先不放行，先补真实错题证据。',
      reportLine: '报告会把它写成“第 7 天换一个条件试一下”，不是立刻加难度或刷综合卷。',
      productRoute: hasWrongPaper ? '/pages/review/review?from=methodology_interleaving' : '/pages/upload/upload?from=methodology_interleaving_locked&type=wrong_question_paper',
      evidenceGate: 'day7_variant_transfer_result',
      sourceBasis: '交错练习、变式迁移和近迁移验证，用来判断方法是否能迁移。'
    },
    {
      id: 'retrieval_spaced_recall',
      label: '主动回忆/间隔复习',
      principle: '隔天和第 7 天回访同一错因，用回忆而不是重看答案验证。',
      useWhen: hasWrongPaper ? '已有错因卡或回访卡。' : '还缺真实错因时先锁住，不能只靠测评开启游戏。',
      reportLine: '报告会把它写成“明天回访哪张卡”，不是加题量或排行榜。',
      productRoute: hasWrongPaper ? '/pages/arcade/arcade?from=methodology_recall' : '/pages/review/review?from=methodology_recall_locked',
      evidenceGate: 'next_day_revisit_and_day7_variant',
      sourceBasis: '检索练习、间隔练习和近迁移验证。'
    },
    {
      id: 'gamified_attention_support',
      label: '游戏化专注支持',
      principle: '只奖励第一步、错因命名和回访完成，不奖励速度、排名或刷题量。',
      useWhen: hasParentReport ? '家长观察到拖拉、分心或启动困难。' : '孩子已经有可回访卡，但需要更轻的坚持机制。',
      reportLine: '报告会建议“小局轻练习”，但要先有真实卡片来源。',
      productRoute: '/pages/arcade/arcade?from=methodology_attention',
      evidenceGate: 'real_recall_source_and_no_answer_leak',
      sourceBasis: '自我调节、即时反馈和低压力动机设计。'
    }
  ];
  return {
    id: 'evidence_based_methodology_guide',
    title: '报告方法论底座',
    summary: '把主流学习法沉淀为可执行、可验证、可回到产品闭环的建议；不用学习风格当固定天赋标签。',
    primaryRecommendation: primaryMethod.label
      ? `${primaryMethod.label}：先试一晚，再用明天回访和第 7 天小变式验证。`
      : '先收集孩子第一步，再选择方法候选。',
    serviceModeLine: serviceMode.label
      ? `当前产品路径优先承接到：${serviceMode.label}。`
      : '默认产品路径：苏格拉底私教先行，小讲堂和游戏化只在证据满足后补位。',
    cards,
    parentTrustContract: {
      promise: '先降低家长焦虑，再给一个今晚能做的小动作。',
      evidenceLine: '所有结论都必须落到上传材料、孩子第一步、错因、隔天回访或第 7 天小变式。',
      productLoop: '报告 -> 苏格拉底私教 -> 小黑板/小课堂兜底 -> 错因卡 -> 间隔回访/游戏化 -> 家长 5 秒复盘。',
      serviceBoundary: '可以自然引导到原点方法论，但不做硬营销、不承诺提分、不输出固定天赋标签。'
    },
    reportWritingRules: [
      '写“方法候选”，不写“固定天赋类型”。',
      '每条建议必须有今晚动作、明天回访和第 7 天验证。',
      '至少覆盖一种理解方法、一种记忆方法、一种迁移验证方法，并说明进入哪个产品页面。',
      '家长能看到原因和下一步，但看不到原题照片、完整答案、分数排名或隐私字段。',
      '轻营销只落在产品方法论：苏格拉底私教、错因卡、间隔回访、游戏化复习和家长 5 秒复盘。'
    ],
    blockedClaims: ['固定学习风格标签', '天赋定性', '人格判断', '诊断注意力问题', '保分提分承诺', '排名刺激'],
    evidenceRequired: ['child_first_step', 'wrong_cause_named', 'next_day_revisit', 'day7_variant_result', 'parent_confirmation']
  };
}

function buildPersonalizedLearningSolutionBlueprint(materialLanes = [], methodHypotheses = [], wrongPaperDiagnosisCards = [], servicePathway = {}) {
  const laneById = materialLanes.reduce((acc, lane) => {
    if (lane && lane.id) acc[lane.id] = lane;
    return acc;
  }, {});
  const hasTalentAssessment = !!(laneById.talent_assessment && laneById.talent_assessment.collected);
  const hasWrongPaper = !!(laneById.wrong_question_paper && laneById.wrong_question_paper.collected);
  const hasScoreSheet = !!(laneById.score_sheet && laneById.score_sheet.collected);
  const hasSchoolMaterial = !!(laneById.school_material && laneById.school_material.collected);
  const hasParentObservation = !!(laneById.parent_report && laneById.parent_report.collected);
  const recommendedMode = hasWrongPaper
    ? {
      id: 'socratic_private_tutor',
      label: '1 对 1 苏格拉底点拨',
      why: '已有真实错题或试卷证据，先让孩子说出第一步和错因。',
      entryRoute: '/pages/tutor/tutor?from=solution_blueprint_wrong_paper'
    }
    : hasTalentAssessment
      ? {
        id: 'method_candidate_validation',
        label: '方法候选验证',
        why: '测评只能说明可能适合的学习方法，必须用真实错题验证。',
        entryRoute: '/pages/upload/upload?from=solution_blueprint_add_wrong_question&materialType=wrong_question_paper'
      }
      : {
        id: 'parent_first_step',
        label: '家庭第一步观察',
        why: '材料还不够，先收集今晚真实卡点和孩子第一步。',
        entryRoute: '/pages/upload/upload?from=solution_blueprint_collect_evidence'
      };
  const modeSequence = [
    {
      id: 'step_1_private_tutor',
      label: '先用苏格拉底私教',
      trigger: '孩子能描述题目或卡住点时',
      localGate: '必须先有孩子自己的第一步或卡住表达',
      aiRole: '把追问改写成孩子听得懂的一句话',
      route: '/pages/tutor/tutor?from=solution_blueprint'
    },
    {
      id: 'step_2_mini_lesson',
      label: '连续卡住才切 3 分钟小讲堂',
      trigger: '同一概念连续卡住、答非所问或只想要答案',
      localGate: '小讲堂只讲一个概念缺口，并要求退出票',
      aiRole: '生成一句老师讲解和一个常见误区同学',
      route: '/pages/tutor/tutor?from=solution_blueprint_mini_lesson'
    },
    {
      id: 'step_3_active_recall',
      label: '过退出门后进轻练习/主动回忆',
      trigger: '孩子能用自己的话说出第一步',
      localGate: '本地代码决定 XP、间隔回访和练习放行',
      aiRole: '只改写近迁移题的提示语气',
      route: '/pages/arcade/arcade?from=solution_blueprint'
    },
    {
      id: 'step_4_parent_report',
      label: '家长看家庭决策书',
      trigger: '今晚动作、明天回访和第 7 天验证形成记录后',
      localGate: '报告只放行证据支持的结论，不贴固定标签',
      aiRole: '把证据改写成低压家长话术',
      route: '/pages/profile/profile?from=solution_blueprint'
    }
  ];
  const evidenceFusionRules = [
    {
      id: 'talent_assessment_rule',
      label: '测评报告',
      useFor: hasTalentAssessment ? '学习方法候选' : '待补充',
      mustVerifyWith: '真实错题第一步、隔天回访、第 7 天小变式',
      cannotClaim: '不做天赋定性、人格标签、升学判断或结果承诺'
    },
    {
      id: 'wrong_paper_rule',
      label: '错题/试卷',
      useFor: hasWrongPaper ? '错因卡、小黑板、轻练习和回访' : '待补充',
      mustVerifyWith: '孩子原想法、卡住第一步、同错因回访',
      cannotClaim: '不生成整卷答案、不自动判分、不做竞争比较'
    },
    {
      id: 'score_sheet_rule',
      label: '成绩/周测',
      useFor: hasScoreSheet ? '私密学科优先级和待验证弱项' : '待补充',
      mustVerifyWith: '对应错题样本、孩子第一步、隔天回访',
      cannotClaim: '不做公开排名、保分承诺、固定提分预期或天赋定性'
    },
    {
      id: 'school_material_rule',
      label: '学校反馈',
      useFor: hasSchoolMaterial ? '家校安全摘要和观察问题' : '待补充',
      mustVerifyWith: '家庭真实作业记录和孩子复述证据',
      cannotClaim: '不替代老师判断，不外发原题照片或完整对话'
    },
    {
      id: 'parent_observation_rule',
      label: '家长观察',
      useFor: hasParentObservation ? '今晚低压陪伴动作' : '待补充',
      mustVerifyWith: '孩子实际作业表现和次日回访',
      cannotClaim: '不把一次情绪或拖拉定性为长期能力问题'
    }
  ];
  const familyLearningPlan = {
    id: 'family_learning_plan',
    title: '家庭学习方案',
    status: hasWrongPaper
      ? 'can_start_tonight'
      : hasTalentAssessment
        ? 'method_candidate_waiting_homework'
        : 'collect_first_real_task',
    sourceWeights: [
      {
        id: 'wrong_question_paper',
        label: '错题/试卷',
        weight: hasWrongPaper ? 40 : 0,
        useFor: hasWrongPaper ? '今晚苏格拉底第一步、错因卡、明天回访' : '待补一处真实卡点'
      },
      {
        id: 'score_sheet',
        label: '成绩/周测',
        weight: hasScoreSheet ? 10 : 0,
        useFor: hasScoreSheet ? '只决定学科优先级和下一条证据，不进入排名或奖励' : '待补成绩或趋势资料'
      },
      {
        id: 'talent_assessment',
        label: '测评/学习偏好',
        weight: hasTalentAssessment ? 20 : 0,
        useFor: hasTalentAssessment ? '只作为学习方法候选，不进入长期画像' : '可选补充材料'
      },
      {
        id: 'school_material',
        label: '学校反馈',
        weight: hasSchoolMaterial ? 20 : 0,
        useFor: hasSchoolMaterial ? '生成家校安全摘要和观察问题' : '暂不生成家校结论'
      },
      {
        id: 'parent_report',
        label: '家长观察',
        weight: hasParentObservation ? 20 : 0,
        useFor: hasParentObservation ? '生成低压陪伴话术和今晚边界' : '待补家庭观察'
      }
    ],
    tonightAction: hasWrongPaper
      ? '只抽一处真实错题卡点：孩子先说第一步，再说错因；说不出时回到苏格拉底点拨。'
      : hasTalentAssessment
        ? '先把测评结论降级为方法候选：补一张真实作业卡点后再决定用哪种学习方式。'
        : '先记录今晚真实卡点：题目类型、孩子第一步、卡住位置和家长观察。',
    tomorrowRevisit: hasWrongPaper
      ? '明天只回访同一错因的一张卡，不加题量，不用分数评价。'
      : '明天先确认孩子能否复述昨天的第一步，再决定是否进入轻练习。',
    day7Evidence: '第 7 天必须有小变式或同错因迁移证据；没有证据时不写长期画像、不贴学习类型标签。',
    parentAssistLine: hasParentObservation
      ? '家长只问：“你第一步想做什么？哪里卡住？明天我们只看这一点还记不记得。”'
      : '家长先不评价能力，只帮孩子把第一步、错因和明天回访时间记下来。',
    modeFit: {
      socraticTutor: hasWrongPaper ? 'default' : 'waiting_real_task',
      miniLesson: hasWrongPaper ? 'locked_until_repeated_stuck' : 'locked_until_homework_evidence',
      gameRecall: hasWrongPaper ? 'after_first_step_evidence' : 'locked_until_wrong_cause_evidence',
      parentReport: hasParentObservation || hasWrongPaper || hasSchoolMaterial ? 'available_as_action_summary' : 'waiting_observation'
    },
    prohibitedConclusions: ['天赋定性', '人格标签', '自动判分', '整卷答案', '排名解释', '结果承诺'],
    releaseGates: ['real_homework_stuck', 'child_first_step', 'wrong_cause_replay', 'next_day_revisit', 'day7_variant_result'],
    aiBoundary: 'AI 只改写苏格拉底追问、家长话术和一句话解释；本地代码决定材料权重、模式放行、报告状态和分享字段。'
  };
  const localVsAiOwnership = [
    {
      id: 'local_code',
      label: '本地代码更适合',
      owns: ['材料分类', '证据权重', '模式放行', '退出门', 'XP/回访', '分享字段', '报告状态'],
      reason: '这些决定影响隐私、合规和奖励，必须稳定、可测、可回滚。'
    },
    {
      id: 'ai',
      label: 'AI 更适合',
      owns: ['苏格拉底追问', '一句话讲解', '误区同学表达', '家长低压话术', '家校摘要润色'],
      reason: '这些需要语言适配和同理心，但不能决定答案、标签、放行和奖励。'
    }
  ];
  return {
    id: 'personalized_learning_solution_blueprint',
    title: '个性化学习方案蓝图',
    status: hasWrongPaper ? 'ready_for_private_tutor' : hasTalentAssessment ? 'method_candidate_needs_wrong_question' : 'collect_more_evidence',
    recommendedMode,
    modeSequence,
    evidenceFusionRules,
    familyLearningPlan,
    localVsAiOwnership,
    methodologyGuide: buildEvidenceBasedMethodologyGuide(
      methodHypotheses.map((item, index) => Object.assign({}, item, {
        rank: index + 1,
        tonightTry: item.childLine || item.method,
        parentQuestionTomorrow: item.parentCheck || '',
        day7Evidence: item.verifyWith || ''
      })),
      materialLanes,
      servicePathway
    ),
    servicePathwayHint: servicePathway && servicePathway.primaryMode
      ? `当前服务路径建议：${servicePathway.primaryMode.label || servicePathway.primaryMode.id || '家庭私教闭环'}`
      : '默认路径：苏格拉底私教优先，小讲堂只在连续卡住后补位。',
    methodHypothesisCount: methodHypotheses.length,
    wrongPaperActionCount: wrongPaperDiagnosisCards.length,
    blockedClaims: ['固定天赋标签', '人格定性', '整卷答案', '自动判分', '竞争比较', '结果承诺']
  };
}

function collectMethodRankingCorpus(input = {}, parts = {}, sources = []) {
  return [input.sourceText, parts.sourceText]
    .concat((sources || []).map((source) => [
      source && source.text,
      source && source.label,
      source && source.sourceSchemaId,
      source && source.structuredCapture && source.structuredCapture.subjectLabel,
      source && source.structuredCapture && source.structuredCapture.taskType,
      source && source.structuredCapture && source.structuredCapture.safe_handoff,
      source && source.structuredCapture && source.structuredCapture.cross_check_gate
    ].filter(Boolean).join(' ')))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function rankMethodHypotheses(methodHypotheses = [], context = {}) {
  const corpus = collectMethodRankingCorpus(context.input || {}, context.parts || {}, context.sources || []);
  const laneById = context.laneById || {};
  const hasTalent = !!(laneById.talent_assessment && laneById.talent_assessment.collected);
  const hasWrongPaper = !!(laneById.wrong_question_paper && laneById.wrong_question_paper.collected);
  const hasSchool = !!(laneById.school_material && laneById.school_material.collected);
  const hasParent = !!(laneById.parent_report && laneById.parent_report.collected);
  return methodHypotheses
    .map((item, index) => {
      const evidence = [];
      let score = 10 - index;
      if (item.id === 'visual_first' && /图|视觉|画|关系图|条件表|小黑板|模型/.test(corpus)) {
        score += 8;
        evidence.push('材料出现视觉化/画图/关系表线索');
      }
      if (item.id === 'verbal_retell' && /复述|听觉|讲|说|题意|阅读|老师反馈/.test(corpus)) {
        score += 7;
        evidence.push('材料出现复述/题意/语言表达线索');
      }
      if (item.id === 'write_first_step' && /列式|动笔|写|公式|计算|第一步|启动|变量/.test(corpus)) {
        score += 7;
        evidence.push('材料出现列式/动笔/第一步启动线索');
      }
      if (hasWrongPaper && item.id === 'write_first_step') {
        score += 5;
        evidence.push('已有错题/试卷，优先验证可执行第一步');
      }
      if (hasTalent && item.id === 'visual_first') {
        score += 3;
        evidence.push('测评只能进入方法候选，先用视觉化候选试错');
      }
      if (hasSchool && item.id === 'verbal_retell') {
        score += 3;
        evidence.push('学校材料更适合转成复述和家校观察问题');
      }
      if (hasParent && item.id === 'verbal_retell') {
        score += 2;
        evidence.push('家长观察优先落到孩子能说清的一句话');
      }
      if (!evidence.length) evidence.push('作为备选方法，等待真实作业验证');
      return Object.assign({}, item, {
        rankScore: score,
        rankingEvidence: evidence,
        rankingSource: 'uploaded_material_local_rules'
      });
    })
    .sort((a, b) => b.rankScore - a.rankScore);
}

function buildUploadedMaterialDecisionDossier(input = {}, parts = {}, sourceEvidenceLedger = {}, reportEvidenceReleaseGate = {}, portraitConfidenceSystem = {}, servicePathway = {}) {
  const sources = Array.isArray(parts.reportSources) ? parts.reportSources : [];
  const aiMaterialAnalysisContract = input.aiMaterialAnalysisContract || {};
  const aiMaterialFallback = aiMaterialAnalysisContract && aiMaterialAnalysisContract.fallback
    ? aiMaterialAnalysisContract.fallback
    : {};
  const aiAnalysisQualityGate = aiMaterialFallback.analysisQuality || input.aiAnalysisQuality || null;
  const lanes = Array.isArray(sourceEvidenceLedger.lanes) ? sourceEvidenceLedger.lanes : [];
  const laneById = lanes.reduce((acc, lane) => {
    acc[lane.id] = lane;
    return acc;
  }, {});
  const safeHandoff = reportEvidenceReleaseGate.homeSchoolSafeHandoff || {};
  const blockedFields = Array.from(new Set([]
    .concat(Array.isArray(safeHandoff.blockedFields) ? safeHandoff.blockedFields : [])
    .concat(['original_question', 'photo', 'full_answer', 'full_dialogue', 'score', 'ranking', 'talent_label', 'personality_label'])));
  const collectedLanes = lanes.filter((lane) => lane.collected);
  const nextQueue = Array.isArray(sourceEvidenceLedger.nextEvidenceQueue)
    ? sourceEvidenceLedger.nextEvidenceQueue.slice(0, 6)
    : [];
  const methodValidationChains = sources
    .map((source) => source && source.methodValidationChallengeChain)
    .filter((chain) => chain && Array.isArray(chain.stages) && chain.stages.length)
    .slice(0, 4);
  const methodValidationStages = methodValidationChains
    .reduce((acc, chain) => acc.concat(chain.stages.map((stage) => Object.assign({
      sourceSchemaId: chain.sourceSchemaId || '',
      chainTitle: chain.title || '',
      releaseRule: chain.releaseRule || '',
      reportCopy: chain.reportCopy || ''
    }, stage))), [])
    .slice(0, 9);
  const methodHypotheses = [
    {
      id: 'visual_first',
      label: '先看图/先画关系',
      method: '适合把题目先变成关系图、条件表或小黑板三格，再开口说第一步。',
      evidence: '来自测评或错题中的视觉化线索，只是方法候选。',
      verifyWith: '用一道真实错题让孩子先画条件关系，再看是否能说出第一步。',
      childLine: '这不是说你只能看图学习，而是今晚先试试把条件画出来。',
      parentCheck: '家长只问：你画出来的是条件、关系，还是答案？'
    },
    {
      id: 'verbal_retell',
      label: '先复述题意',
      method: '适合先把对象、条件、目标各说一遍，再进入列式、推理或作答。',
      evidence: '来自阅读理解、应用题或老师反馈中的审题卡点。',
      verifyWith: '隔天换一题，让孩子先复述对象、条件和目标。',
      childLine: '先把题目讲给自己听，再决定第一步写什么。',
      parentCheck: '家长只问：这题问什么？已知什么？先找哪一个关系？'
    },
    {
      id: 'write_first_step',
      label: '先动笔写第一步',
      method: '适合把“我懂了”变成一个可检查动作：写关系式、圈证据句或列实验变量。',
      evidence: '来自计算、方程、推理或实验题里的启动困难。',
      verifyWith: '第 7 天用小变式确认是否能迁移，而不是当场会。',
      childLine: '先写一个小动作，不要求一步到答案。',
      parentCheck: '家长只看第一步是否能独立写出，不看最终答案是否漂亮。'
    }
  ];
  const wrongPaperDiagnosisCards = [
    {
      id: 'question_type',
      label: '题型定位',
      rule: '先把错题归到题型和第一步，不把整张卷子变成答案库。',
      nextAction: '选一题，让孩子说“这类题第一步先看什么”。'
    },
    {
      id: 'wrong_cause',
      label: '错因命名',
      rule: '错因必须来自孩子原想法、卡住点或订正痕迹，不能由 AI 自动判定。',
      nextAction: '记录一个错因词：审题、关系、单位、公式、证据句或过程链。'
    },
    {
      id: 'revisit_window',
      label: '回访窗口',
      rule: '今晚只修第一步；明天回访同错因；第 7 天做小变式。',
      nextAction: '把这张错题变成一张回访卡，而不是继续刷整卷。'
    }
  ];
  const materialLanes = [
    {
      id: 'talent_assessment',
      label: '天赋/学习偏好测评',
      collected: !!(laneById.talent_assessment && laneById.talent_assessment.collected),
      canSay: '可以说“更适合先试哪种学习方法”。',
      cannotSay: '不能说“孩子天赋就是某一类”，也不能做升学、人格或长期能力定性。',
      output: '学习方法候选和验证计划',
      nextEvidence: '补一条真实错题第一步、一次隔天回访和第 7 天小变式。'
    },
    {
      id: 'wrong_question_paper',
      label: '错题/试卷',
      collected: !!(laneById.wrong_question_paper && laneById.wrong_question_paper.collected),
      canSay: '可以说当前错因、第一步和今晚修复动作。',
      cannotSay: '不能自动给整卷答案、判分、排名或长期掌握结论。',
      output: '错因卡、第一步小黑板、轻练习和间隔回访',
      nextEvidence: '让孩子留下原想法和卡住的第一步。'
    },
    {
      id: 'score_sheet',
      label: '成绩单/周测',
      collected: !!(laneById.score_sheet && laneById.score_sheet.collected),
      canSay: '可以说哪一科、哪类题优先补证据。',
      cannotSay: '不能说排名、保分、固定提分预期或天赋定性。',
      output: '私密优先级和下一证据队列',
      nextEvidence: '补一题对应错题、孩子第一步和隔天回访结果。'
    },
    {
      id: 'school_material',
      label: '学校/老师材料',
      collected: !!(laneById.school_material && laneById.school_material.collected),
      canSay: '可以整理家校沟通摘要和观察问题。',
      cannotSay: '不能替代老师判断，不能外传原题照片、排名或完整对话。',
      output: '家校安全摘要和家庭配合动作',
      nextEvidence: '补家庭观察和孩子复述证据。'
    },
    {
      id: 'parent_report',
      label: '家长观察',
      collected: !!(laneById.parent_report && laneById.parent_report.collected),
      canSay: '可以形成今晚低压陪伴动作。',
      cannotSay: '不能把一次情绪或拖拉直接定性为能力问题。',
      output: '家长 5 秒复盘和明天验收句',
      nextEvidence: '补真实作业卡点和明天回访结果。'
    }
  ];
  const collectedCount = materialLanes.filter((lane) => lane.collected).length;
  const primaryWrongPaperCard = wrongPaperDiagnosisCards[0] || {};
  const primaryValidationStage = methodValidationStages[0] || {};
  const rankedMethodHypotheses = rankMethodHypotheses(methodHypotheses, { input, parts, sources, laneById });
  const methodCandidateCards = rankedMethodHypotheses.map((item, index) => ({
    id: `method_candidate_${item.id || index + 1}`,
    label: item.label,
    status: laneById.talent_assessment && laneById.talent_assessment.collected ? 'method_candidate_from_assessment' : 'method_candidate_waiting_evidence',
    sourceSchemaId: (sources[0] && sources[0].sourceSchemaId) || input.materialType || 'mixed_uploaded_material',
    sourceTextEvidence: sanitizeEvidenceSnippet((sources[0] && sources[0].text) || input.sourceText || parts.sourceText || ''),
    confidenceReason: item.rankingEvidence && item.rankingEvidence.length
      ? item.rankingEvidence.join('；')
      : (collectedLanes.length >= 2 ? 'evidence_cross_checked' : 'needs_more_evidence'),
    rank: index + 1,
    rankScore: item.rankScore,
    rankingSource: item.rankingSource,
    rankingEvidence: item.rankingEvidence || [],
    tonightTry: item.childLine || item.method,
    tonightWrongQuestionTest: primaryWrongPaperCard.nextAction || '先选一题真实错题，只验证第一步，不追完整答案。',
    parentQuestionTomorrow: item.parentCheck || '明天只问：你还能说出第一步和错因吗？',
    day7Evidence: primaryValidationStage.requiredEvidence || primaryValidationStage.releaseRule || item.verifyWith || '第 7 天换一道小变式，只看能否迁移第一步。',
    reportCopy: item.evidence || '这是学习方法候选，不是天赋标签。',
    releaseRule: '必须经过真实错题、隔天回访、第 7 天小变式验证；不生成天赋定性、人格标签或升学判断。',
    route: primaryValidationStage.route || '/pages/review/review?from=method_candidate_card',
    blockedClaims: ['天赋定性', '人格标签', '完整答案', '自动判分', '排名刺激']
  }));
  const decisionHeatmap = [
    {
      id: 'method_fit',
      label: '学习方法适配',
      status: laneById.talent_assessment && laneById.talent_assessment.collected ? '候选可用' : '待补材料',
      score: laneById.talent_assessment && laneById.talent_assessment.collected ? 2 : 1,
      evidence: laneById.talent_assessment && laneById.talent_assessment.collected
        ? '已有测评/学习偏好材料，但只进入方法候选。'
        : '先用家长观察或真实错题补一个学习方式线索。',
      nextAction: '用一题真实作业验证孩子是否能说出第一步。'
    },
    {
      id: 'wrong_cause_repair',
      label: '错因修复',
      status: laneById.wrong_question_paper && laneById.wrong_question_paper.collected ? '可进入修复' : '证据不足',
      score: laneById.wrong_question_paper && laneById.wrong_question_paper.collected ? 3 : 1,
      evidence: laneById.wrong_question_paper && laneById.wrong_question_paper.collected
        ? '已有错题/试卷材料，可转成错因卡和回访卡。'
        : '还缺真实错题、孩子原想法或卡住步骤。',
      nextAction: primaryWrongPaperCard.nextAction || '先选一题真实错题，只验证第一步。'
    },
    {
      id: 'parent_support',
      label: '家长陪伴动作',
      status: laneById.parent_report && laneById.parent_report.collected ? '可执行' : '待观察',
      score: laneById.parent_report && laneById.parent_report.collected ? 2 : 1,
      evidence: laneById.parent_report && laneById.parent_report.collected
        ? '已有家长观察，可生成低压陪伴话术。'
        : '还缺晚上作业情绪、拖延或开口情况。',
      nextAction: '家长今晚只问一个第一步问题，不接管答案。'
    },
    {
      id: 'home_school_bridge',
      label: '家校协同',
      status: laneById.school_material && laneById.school_material.collected ? '可安全摘要' : '暂不外发',
      score: laneById.school_material && laneById.school_material.collected ? 2 : 0,
      evidence: laneById.school_material && laneById.school_material.collected
        ? '已有学校/老师材料，可整理观察问题。'
        : '缺老师反馈时不生成家校摘要。',
      nextAction: '只整理观察问题和家庭动作，不带原题、答案、分数或排名。'
    }
  ];
  const familyActionStack = [
    {
      id: 'tonight',
      label: '今晚',
      action: methodCandidateCards[0] ? methodCandidateCards[0].tonightTry : '先让孩子说出第一步。',
      gate: '孩子能说出第一步，才进入回访卡。'
    },
    {
      id: 'tomorrow',
      label: '明天',
      action: methodCandidateCards[0] ? methodCandidateCards[0].parentQuestionTomorrow : '明天只问同一错因能否复述。',
      gate: '同错因能复述，才允许换题。'
    },
    {
      id: 'day7',
      label: '第 7 天',
      action: methodCandidateCards[0] ? methodCandidateCards[0].day7Evidence : '做一题小变式，只看第一步迁移。',
      gate: '能迁移第一步，才把方法候选写入阶段画像。'
    }
  ];
  const aiQualityValidationPlan = aiAnalysisQualityGate ? [
    {
      id: 'quality_first_step',
      label: 'AI解析第一步核验',
      status: aiAnalysisQualityGate.missingEvidence && aiAnalysisQualityGate.missingEvidence.indexOf('first_step') >= 0 ? 'needs_child_evidence' : 'ready',
      action: '让孩子先说出这一份材料对应的第一步，不进入完整答案。',
      evidence: 'child_first_step'
    },
    {
      id: 'quality_wrong_cause',
      label: 'AI解析错因核验',
      status: aiAnalysisQualityGate.missingEvidence && aiAnalysisQualityGate.missingEvidence.indexOf('wrong_cause') >= 0 ? 'needs_wrong_cause' : 'ready',
      action: '只命名一个错因候选，再用一道真实错题验证。',
      evidence: 'wrong_cause_named'
    },
    {
      id: 'quality_revisit',
      label: 'AI解析隔天回访',
      status: aiAnalysisQualityGate.status === 'draft_can_enter_local_execution' ? 'scheduled' : 'fallback_required',
      action: '明天只回访同一个第一步和错因，仍不释放长期结论。',
      evidence: 'next_day_revisit'
    }
  ] : [];
  const familyDecisionCalendar = buildFamilyDecisionCalendar(input, methodCandidateCards, wrongPaperDiagnosisCards, reportEvidenceReleaseGate);
  const evidenceBasedMethodologyGuide = buildEvidenceBasedMethodologyGuide(methodCandidateCards, materialLanes, servicePathway);
  const personalizedLearningSolutionBlueprint = buildPersonalizedLearningSolutionBlueprint(
    materialLanes,
    methodHypotheses,
    wrongPaperDiagnosisCards,
    servicePathway
  );
  personalizedLearningSolutionBlueprint.primaryMethodCandidate = methodCandidateCards[0] ? {
    id: methodCandidateCards[0].id,
    label: methodCandidateCards[0].label,
    rankScore: methodCandidateCards[0].rankScore,
    confidenceReason: methodCandidateCards[0].confidenceReason,
    route: methodCandidateCards[0].route
  } : null;
  personalizedLearningSolutionBlueprint.methodRankingRules = {
    id: 'method_candidate_ranking_rules',
    localCodeOwns: ['source_schema', 'structured_capture', 'lane_collected_status', 'rank_score', 'release_gate'],
    aiMayRewrite: ['child_line', 'parent_check', 'report_copy'],
    blocked: ['talent_label', 'personality_label', 'automatic_score', 'ranking_compare', 'guaranteed_improvement']
  };
  const familyPrivateTutorSolutionPack = {
    id: 'family_private_tutor_solution_pack',
    title: '家庭私教补位方案',
    positioning: '不是 AI 课堂平台，而是把上传材料转成今晚可执行的一对一苏格拉底私教补位。',
    primaryPromise: '先验证一种学习方法，再沉淀错因和回访证据；不贴天赋标签，不承诺提分。',
    sourceToPlanMap: materialLanes.map((lane) => ({
      id: lane.id,
      label: lane.label,
      collected: !!lane.collected,
      planRole: lane.id === 'talent_assessment'
        ? '方法候选来源'
        : lane.id === 'wrong_question_paper'
          ? '错因修复来源'
          : lane.id === 'school_material'
            ? '家校沟通来源'
            : '家庭观察来源',
      releaseGate: lane.id === 'talent_assessment'
        ? '必须补真实错题、隔天回访和第 7 天小变式后才更新画像'
        : '必须有孩子第一步证据后才进入练习、分享或长期画像',
      cannotSay: lane.cannotSay
    })),
    modeOrchestration: [
      {
        id: 'socratic_tutor',
        label: '苏格拉底私教',
        when: '默认主线：孩子还能回答或只需要一层点拨时',
        localGate: 'child_attempt_or_first_step_recorded',
        aiBetterFor: '追问措辞、低压解释、孩子能听懂的一句话'
      },
      {
        id: 'three_minute_mini_lesson',
        label: '3 分钟小讲堂',
        when: '连续卡住、第一步说不出、或误区反复出现时才补位',
        localGate: 'child_exit_ticket_before_practice',
        aiBetterFor: '小黑板讲一句、AI 同学暴露一个常见误区'
      },
      {
        id: 'active_recall_game',
        label: '主动回忆游戏',
        when: '已有真实错题/回忆卡和孩子第一步证据后',
        localGate: 'real_recall_source_and_no_answer_leak',
        aiBetterFor: '变换题干语气和鼓励反馈；不决定 XP 或掌握'
      },
      {
        id: 'parent_decision_book',
        label: '家长决策书',
        when: '每次上传、回访或小讲堂退出后',
        localGate: 'safe_fields_and_next_evidence_queue',
        aiBetterFor: '家长摘要、家校沟通措辞、今晚一句检查话术'
      }
    ],
    deliveryLoop: [
      { day: 0, label: '今晚', evidence: 'child_first_step', action: familyActionStack[0] ? familyActionStack[0].action : '先说第一步' },
      { day: 1, label: '明天', evidence: 'next_day_revisit', action: familyActionStack[1] ? familyActionStack[1].action : '回访同一错因' },
      { day: 7, label: '第 7 天', evidence: 'near_transfer_first_step', action: familyActionStack[2] ? familyActionStack[2].action : '小变式验证' },
      { day: 14, label: '第 14 天', evidence: 'two_week_stability_check', action: '只有跨周稳定后，才把方法候选写入阶段画像。' }
    ],
    commercialHandoff: {
      canSell: ['测评报告复合解读', '7 天家庭作业陪跑', '错因修复包', '家校沟通摘要', '线上课前诊断'],
      mustNotSellAs: ['天赋定论', '自动判分', '拍照搜题答案', '结果承诺', '排名刺激'],
      handoffRoute: servicePathway && servicePathway.primaryTier ? servicePathway.primaryTier : null,
      partnerBoundary: '合作方材料只作为方法候选和证据来源；最终放行由本地证据链决定。'
    },
    moatSignals: [
      '上传材料不直接下结论，而是进入证据账本',
      '小讲堂只在苏格拉底卡住后触发，避免课堂平台漂移',
      '游戏奖励只绑定真实回忆来源和孩子第一步证据',
      '家长看到的是下一步行动和边界，不是焦虑型标签'
    ],
    blockedClaims: blockedFields.concat(['guaranteed_improvement', 'fixed_talent_type'])
  };
  const releaseStatus = reportEvidenceReleaseGate.releaseDecision || 'collect_more_evidence';
  const detailedReportSections = [
    {
      id: 'method_candidate',
      label: '孩子可能更适合怎么学',
      status: laneById.talent_assessment && laneById.talent_assessment.collected ? '有测评候选' : '待补测评或观察',
      body: '报告只输出学习方法候选，不输出固定天赋标签。候选方法必须被真实错题、隔天回访和第 7 天小变式验证。',
      rows: methodHypotheses.map((item) => `${item.label}：${item.method}`)
    },
    {
      id: 'wrong_paper_diagnosis',
      label: '错题/试卷怎么转成能力修复',
      status: laneById.wrong_question_paper && laneById.wrong_question_paper.collected ? '已接入错题材料' : '待补错题材料',
      body: '错题材料优先转成题型、错因、第一步和回访窗口，不生成整卷答案、不自动判分。',
      rows: wrongPaperDiagnosisCards.map((item) => `${item.label}：${item.nextAction}`)
    },
    {
      id: 'home_school_handoff',
      label: '家校沟通能说什么',
      status: laneById.school_material && laneById.school_material.collected ? '可生成安全摘要' : '待补老师反馈',
      body: '家校沟通只带观察问题和下一步动作，不带原题照片、答案、分数、排名或完整对话。',
      rows: ['老师可看：孩子先卡在哪一步', '家长可做：今晚只问一个第一步', '下次补证据：隔天回访结果']
    },
    {
      id: 'evidence_roadmap',
      label: '长期画像什么时候才可信',
      status: releaseStatus,
      body: '单次测评、单次错题或单次家长观察都不能直接形成长期结论。',
      rows: ['第 1 天：说出第一步', '第 2 天：同错因回访', '第 7 天：小变式迁移', '第 14 天：稳定性复核']
    }
  ];
  return {
    id: 'uploaded_material_decision_dossier',
    title: '上传资料到家庭决策报告',
    status: collectedCount >= 2 ? 'multi_source_candidate' : 'collect_more_evidence',
    summary: `已接入 ${collectedCount}/${materialLanes.length} 类资料；先输出方法候选和今晚动作，长期画像等回访证据齐了再放行。`,
    reportUseRule: '上传材料只进入证据卷宗；本地代码决定证据权重、放行门槛、分享字段和下一步动作。',
    talentRule: '天赋/学习偏好测评只能生成学习方法候选，必须用错题、第一步、隔天回访和第 7 天小变式验证。',
    wrongPaperRule: '错题/试卷优先生成错因、第一步小黑板、轻练习和回访，不生成整卷答案或排名刺激。',
    schoolRule: '学校/老师材料只生成家校安全摘要、观察问题和家庭配合动作，不替代老师判断。',
    childStrengthLine: portraitConfidenceSystem.confidenceLevel === 'high'
      ? '可以描述阶段性学习优势，但仍按“证据支持的学习方法”表达，不贴固定天赋标签。'
      : '当前只能说“可能更适合的学习方法”，不能给孩子贴天赋或人格标签。',
    howToLearnBetter: methodHypotheses,
    methodCandidateCards,
    decisionHeatmap,
    familyActionStack,
    aiAnalysisQualityGate,
    aiQualityValidationPlan,
    aiQualityLine: aiAnalysisQualityGate
      ? `AI解析质量：${aiAnalysisQualityGate.status || 'pending'}，分数 ${Number(aiAnalysisQualityGate.score || 0)}，缺口 ${(aiAnalysisQualityGate.missingEvidence || []).join(' / ') || 'none'}`
      : 'AI解析质量：等待上传材料分析或本地兜底。',
    familyDecisionCalendar,
    evidenceBasedMethodologyGuide,
    familyPrivateTutorSolutionPack,
    personalizedLearningSolutionBlueprint,
    wrongPaperDiagnosisCards,
    methodValidationChains,
    methodValidationStages,
    methodValidationReleaseRule: methodValidationChains[0]
      ? methodValidationChains[0].releaseRule
      : '上传材料先变成方法候选和今晚动作；长期画像必须等真实作业、回访和第 7 天小变式验证。',
    methodValidationNextAction: methodValidationStages[0]
      ? methodValidationStages[0].label
      : '补一条真实作业第一步证据',
    servicePathwaySummary: servicePathway && servicePathway.id ? {
      status: servicePathway.status || '',
      primaryMode: servicePathway.primaryMode || null,
      primaryTier: servicePathway.primaryTier || null,
      releaseGate: servicePathway.safetyBoundary ? servicePathway.safetyBoundary.releaseGate : '',
      modeChoiceProtocol: servicePathway.modeChoiceProtocol ? {
        id: servicePathway.modeChoiceProtocol.id || '',
        recommendedModeId: servicePathway.modeChoiceProtocol.recommendedModeId || '',
        recommendedModeLabel: servicePathway.modeChoiceProtocol.recommendedModeLabel || '',
        releaseGate: servicePathway.modeChoiceProtocol.releaseGate || '',
        positioningLine: servicePathway.modeChoiceProtocol.positioningLine || '',
        choiceCards: Array.isArray(servicePathway.modeChoiceProtocol.choiceCards)
          ? servicePathway.modeChoiceProtocol.choiceCards.slice(0, 6).map((card) => ({
            id: card.id || '',
            label: card.label || '',
            choiceRole: card.choiceRole || '',
            recommended: !!card.recommended,
            childCanChoose: !!card.childCanChoose,
            parentConfirmRequired: !!card.parentConfirmRequired,
            lockReason: card.lockReason || '',
            exitEvidenceRequired: Array.isArray(card.exitEvidenceRequired) ? card.exitEvidenceRequired.slice(0, 4) : []
          }))
          : [],
        guardrails: Array.isArray(servicePathway.modeChoiceProtocol.guardrails)
          ? servicePathway.modeChoiceProtocol.guardrails.slice(0, 4)
          : []
      } : null,
      validationPlan: Array.isArray(servicePathway.validationPlan) ? servicePathway.validationPlan.slice(0, 7) : [],
      partnerHandoffPolicy: servicePathway.partnerHandoffPolicy || null,
      blockedClaims: servicePathway.safetyBoundary && Array.isArray(servicePathway.safetyBoundary.blocked)
        ? servicePathway.safetyBoundary.blocked
        : []
    } : null,
    detailedReportSections,
    materialLanes,
    nextEvidenceQueue: nextQueue,
    parentDecisionSections: [
      { id: 'five_second', label: '5 秒结论', body: '今晚只做一个第一步动作，不追加题量。' },
      { id: 'seven_day', label: '7 天验证', body: '第 1 天第一步，第 2 天回访，第 7 天小变式。' },
      { id: 'monthly', label: '周/月画像', body: '只有跨周稳定后才更新长期画像和家校沟通摘要。' }
    ],
    aiLocalSplit: [
      { id: 'local', label: '本地代码', owns: '资料分流、证据权重、放行门槛、分享字段、奖励和报告状态。' },
      { id: 'ai', label: 'AI 更适合', owns: '苏格拉底追问、家长低压话术、小黑板解释、老师沟通摘要改写。' },
      { id: 'blocked', label: '禁止交给 AI', owns: '天赋定性、人格标签、完整答案、自动判分、排名刺激、长期掌握结论。' }
    ],
    releaseGate: {
      status: releaseStatus,
      requiredEvidence: ['child_first_step', 'wrong_cause_card', 'next_day_revisit', 'day7_variant_result', 'two_week_stability_check'],
      blockedFields
    },
    shareSafePayload: {
      allowedFields: Array.isArray(safeHandoff.allowedFields) && safeHandoff.allowedFields.length
        ? safeHandoff.allowedFields.slice(0, 8)
        : ['tonight_action', 'method_candidate', 'next_evidence_needed', 'revisit_window'],
      blockedFields
    },
    routeActions: [
      { id: 'upload_more', label: '补资料', route: '/pages/upload/upload?from=uploaded_material_dossier' },
      { id: 'ask_first_step', label: '问第一步', route: '/pages/tutor/tutor?from=uploaded_material_dossier' },
      { id: 'review_revisit', label: '做回访', route: '/pages/review/review?from=uploaded_material_dossier' }
    ].concat(methodValidationStages.slice(0, 3).map((stage, index) => ({
      id: `method_validation_${index + 1}`,
      label: stage.label || `验证 ${index + 1}`,
      route: stage.route || '/pages/review/review?from=method_validation',
      reason: stage.releaseRule || stage.requiredEvidence || '按证据链验证方法候选，不贴标签。'
    }))),
    collectedSourceIds: collectedLanes.map((lane) => lane.id),
    evidenceRequired: ['source_type', 'method_candidate', 'child_first_step', 'wrong_cause_card', 'next_day_revisit', 'day7_variant_result', 'safe_share_fields', 'ai_analysis_quality_gate']
  };
}

function buildParentDecisionBook(input = {}) {
  const familyDecisionMemo = input.familyDecisionMemo || {};
  const tonightDecisionBrief = input.tonightDecisionBrief || {};
  const parentDecisionTrustSystem = input.parentDecisionTrustSystem || {};
  const reportEvidenceReleaseGate = input.reportEvidenceReleaseGate || {};
  const sourceEvidenceLedger = input.sourceEvidenceLedger || {};
  const portraitConfidenceSystem = input.portraitConfidenceSystem || {};
  const servicePathway = input.servicePathway || {};
  const releaseDecision = reportEvidenceReleaseGate.releaseDecision || 'collect_more_evidence';
  const safeHandoff = reportEvidenceReleaseGate.homeSchoolSafeHandoff || {};
  const nextEvidenceQueue = Array.isArray(sourceEvidenceLedger.nextEvidenceQueue) ? sourceEvidenceLedger.nextEvidenceQueue : [];
  const evidenceRequired = Array.from(new Set([
    'child_first_step',
    'wrong_cause_card',
    'next_day_revisit',
    'day7_variant_result',
    'two_week_stability_check'
  ].concat(
    Array.isArray(reportEvidenceReleaseGate.evidenceRequired) ? reportEvidenceReleaseGate.evidenceRequired : [],
    Array.isArray(sourceEvidenceLedger.evidenceRequired) ? sourceEvidenceLedger.evidenceRequired : []
  ))).slice(0, 10);
  const releaseGates = [
    reportEvidenceReleaseGate.singleSampleLock,
    reportEvidenceReleaseGate.day7Gate,
    reportEvidenceReleaseGate.twoWeekStabilityGate,
    safeHandoff
  ].filter(Boolean).map((gate, index) => ({
    id: gate.id || ['single_sample', 'day7', 'two_week', 'safe_handoff'][index] || `gate_${index + 1}`,
    status: gate.status || 'locked',
    rule: gate.rule || gate.handoffRule || '',
    requiredEvidence: gate.requiredEvidence || []
  }));
  const tonightDo = Array.isArray(tonightDecisionBrief.tonightDo) && tonightDecisionBrief.tonightDo.length
    ? tonightDecisionBrief.tonightDo.slice(0, 3)
    : [familyDecisionMemo.tonightDecision || '今晚只做一个第一步动作，不加题量。'];
  const tonightDoNot = Array.isArray(tonightDecisionBrief.tonightDoNot) && tonightDecisionBrief.tonightDoNot.length
    ? tonightDecisionBrief.tonightDoNot.slice(0, 3)
    : (Array.isArray(familyDecisionMemo.doNotDo) ? familyDecisionMemo.doNotDo.slice(0, 3) : ['不讲完整答案', '不按单次表现贴标签', '不分享原题和分数排名']);
  return {
    id: 'parent_decision_book',
    title: '家长决策书',
    status: releaseDecision,
    oneSentenceDecision: tonightDecisionBrief.headline
      || familyDecisionMemo.tonightDecision
      || parentDecisionTrustSystem.decisionLine
      || '今晚先收一条真实证据，只做一个低压动作。',
    whyNow: parentDecisionTrustSystem.decisionLine
      || (portraitConfidenceSystem.portraitStageReason || '当前证据只够支持今晚行动，不够给孩子定性。'),
    tonightDo,
    tonightDoNot,
    tomorrowCheck: tonightDecisionBrief.tomorrowRevisit || '明天换一题回访同一第一步。',
    releaseGates,
    servicePathway: servicePathway && servicePathway.id ? {
      status: servicePathway.status || '',
      primaryMode: servicePathway.primaryMode || null,
      primaryTier: servicePathway.primaryTier || null,
      releaseGate: servicePathway.safetyBoundary ? servicePathway.safetyBoundary.releaseGate : '',
      modeChoiceProtocol: servicePathway.modeChoiceProtocol ? {
        id: servicePathway.modeChoiceProtocol.id || '',
        recommendedModeId: servicePathway.modeChoiceProtocol.recommendedModeId || '',
        recommendedModeLabel: servicePathway.modeChoiceProtocol.recommendedModeLabel || '',
        releaseGate: servicePathway.modeChoiceProtocol.releaseGate || '',
        positioningLine: servicePathway.modeChoiceProtocol.positioningLine || '',
        choiceCards: Array.isArray(servicePathway.modeChoiceProtocol.choiceCards)
          ? servicePathway.modeChoiceProtocol.choiceCards.slice(0, 6).map((card) => ({
            id: card.id || '',
            label: card.label || '',
            choiceRole: card.choiceRole || '',
            recommended: !!card.recommended,
            childCanChoose: !!card.childCanChoose,
            parentConfirmRequired: !!card.parentConfirmRequired,
            lockReason: card.lockReason || '',
            exitEvidenceRequired: Array.isArray(card.exitEvidenceRequired) ? card.exitEvidenceRequired.slice(0, 4) : []
          }))
          : [],
        guardrails: Array.isArray(servicePathway.modeChoiceProtocol.guardrails)
          ? servicePathway.modeChoiceProtocol.guardrails.slice(0, 4)
          : []
      } : null,
      validationPlan: Array.isArray(servicePathway.validationPlan) ? servicePathway.validationPlan.slice(0, 7) : [],
      partnerHandoffPolicy: servicePathway.partnerHandoffPolicy || null
    } : null,
    sharePolicy: {
      allowedFields: Array.isArray(safeHandoff.allowedFields) ? safeHandoff.allowedFields.slice(0, 8) : ['tonight_action', 'parent_question', 'next_day_revisit_status'],
      blockedFields: Array.isArray(safeHandoff.blockedFields) ? safeHandoff.blockedFields.slice(0, 12) : ['original_question', 'full_answer', 'score', 'ranking', 'full_dialogue', 'child_name', 'parent_phone', 'parent_wechat', 'contact_info'],
      line: tonightDecisionBrief.shareLine || familyDecisionMemo.shareLine || '只分享行动、证据缺口和回访时间，不分享原题、答案、分数、排名、完整对话、孩子姓名或家长联系方式。'
    },
    routeActions: [
      { id: 'ask_first_step', label: '先问第一步', route: '/pages/tutor/tutor?from=parent_decision_book', evidence: 'child_first_step' },
      { id: 'repair_wrong_cause', label: '修错因卡', route: '/pages/review/review?from=parent_decision_book', evidence: 'wrong_cause_card' },
      { id: 'collect_more', label: '补资料证据', route: '/pages/upload/upload?from=parent_decision_book', evidence: nextEvidenceQueue[0] ? nextEvidenceQueue[0].id : 'next_day_revisit' }
    ],
    aiLocalBoundary: {
      localCodeOwns: ['证据是否足够', '画像是否放行', '分享字段', '家校交接字段', '是否加题量'],
      aiBetterFor: ['苏格拉底追问', '小黑板解释文案', '家长低压话术', '老师沟通摘要'],
      aiBlocked: ['完整答案', '天赋定性', '长期掌握结论', '分数排名刺激', '老师替代判断']
    },
    evidenceRequired,
    nextEvidenceQueue: nextEvidenceQueue.slice(0, 5),
    portraitStageLabel: portraitConfidenceSystem.portraitStageLabel || '',
    portraitNextEvidenceAction: portraitConfidenceSystem.portraitNextEvidenceAction || ''
  };
}

function buildCommercialFamilySolutionBook(input = {}) {
  const parentDecisionBook = input.parentDecisionBook || {};
  const uploadedMaterialDecisionDossier = input.uploadedMaterialDecisionDossier || {};
  const servicePathway = input.servicePathway || {};
  const sourceEvidenceLedger = input.sourceEvidenceLedger || {};
  const reportEvidenceReleaseGate = input.reportEvidenceReleaseGate || {};
  const tonightDecisionBrief = input.tonightDecisionBrief || {};
  const aiMaterialAnalysisContract = input.aiMaterialAnalysisContract || {};
  const aiMaterialFallback = aiMaterialAnalysisContract && aiMaterialAnalysisContract.fallback
    ? aiMaterialAnalysisContract.fallback
    : {};
  const nextEvidence = Array.isArray(parentDecisionBook.nextEvidenceQueue) && parentDecisionBook.nextEvidenceQueue.length
    ? parentDecisionBook.nextEvidenceQueue
    : (Array.isArray(sourceEvidenceLedger.nextEvidenceQueue) ? sourceEvidenceLedger.nextEvidenceQueue : []);
  const methodCards = Array.isArray(uploadedMaterialDecisionDossier.methodCandidateCards)
    ? uploadedMaterialDecisionDossier.methodCandidateCards.slice(0, 3)
    : [];
  const actionStack = Array.isArray(uploadedMaterialDecisionDossier.familyActionStack)
    ? uploadedMaterialDecisionDossier.familyActionStack.slice(0, 4)
    : [];
  const validationPlan = servicePathway && Array.isArray(servicePathway.validationPlan)
    ? servicePathway.validationPlan.slice(0, 7)
    : [];
  const modeChoice = servicePathway && servicePathway.modeChoiceProtocol ? servicePathway.modeChoiceProtocol : {};
  const recommendedModeId = modeChoice.recommendedModeId || (servicePathway.primaryMode && servicePathway.primaryMode.id) || 'socratic_first_step';
  const executionPathMap = [
    {
      id: 'socratic_first_step',
      label: '苏格拉底私教',
      role: '卡住时先问第一步，验证孩子是否真的能启动。',
      route: '/pages/tutor/tutor?from=solution_book_socratic',
      openWhen: '已有真实作业、错题或家长观察中的一个具体卡点。',
      evidenceGate: 'child_first_step_before_hint',
      recommended: recommendedModeId === 'socratic_first_step'
    },
    {
      id: 'three_minute_mini_lesson',
      label: '三分钟小课堂',
      role: '概念断层或看不懂题意时，先用小黑板式解释搭桥。',
      route: '/pages/tutor/tutor?from=solution_book_mini_lesson',
      openWhen: '孩子说不出第一步，且错因更像概念或图像理解断层。',
      evidenceGate: 'mini_lesson_returns_to_first_step',
      recommended: recommendedModeId === 'three_minute_mini_lesson'
    },
    {
      id: 'game_recall',
      label: '游戏化回访',
      role: '只在已有真实回忆卡后开放，每天回来修一个最该修的错因。',
      route: '/pages/arcade/arcade?from=solution_book_recall',
      openWhen: '已经产生第一步、错因和明天回访卡。',
      evidenceGate: 'real_recall_card_before_xp',
      recommended: recommendedModeId === 'game_recall'
    },
    {
      id: 'parent_decision_report',
      label: '家长决策书',
      role: '把今晚动作、7 天证据和下一次服务建议交付给家长。',
      route: '/pages/profile/profile?from=solution_book_parent',
      openWhen: '家长确认交付范围，且分享字段通过白名单。',
      evidenceGate: 'safe_handoff_and_parent_confirmation',
      recommended: recommendedModeId === 'parent_decision_report'
    }
  ];
  return {
    id: 'commercial_family_solution_book',
    title: 'Family solution book',
    status: reportEvidenceReleaseGate.releaseDecision || parentDecisionBook.status || 'collect_more_evidence',
    pages: [
      {
        id: 'one_page_diagnosis',
        title: 'One-page diagnosis',
        body: parentDecisionBook.oneSentenceDecision || tonightDecisionBrief.headline || 'Only release tonight action until evidence is confirmed.',
        evidenceGate: 'source_type_and_structured_evidence_confirmed'
      },
      {
        id: 'method_candidates',
        title: 'Method candidates',
        body: methodCards.length ? methodCards.map((item) => item.method || item.label || item.title).filter(Boolean) : ['Socratic first-step validation', 'three-minute mini lesson only as rescue', 'game recall only after real card evidence'],
        evidenceGate: 'talent_or_assessment_degraded_to_method_hypothesis'
      },
      {
        id: 'seven_day_action',
        title: '7-day action plan',
        body: actionStack.length ? actionStack.map((item) => item.action || item.label).filter(Boolean) : ['Tonight: one first step', 'Tomorrow: revisit the same wrong cause', 'Day 7: one near-transfer variant'],
        evidenceGate: 'day7_variant_before_method_claim'
      },
      {
        id: 'parent_script',
        title: 'Parent script',
        body: parentDecisionBook.tonightDo && parentDecisionBook.tonightDo.length
          ? parentDecisionBook.tonightDo
          : [tonightDecisionBrief.parentScript || 'Ask only: what is your first step?'],
        evidenceGate: 'low_pressure_parent_prompt_only'
      },
      {
        id: 'review_evidence',
        title: 'Review evidence',
        body: nextEvidence.slice(0, 5).map((item) => item.label || item.id || item).filter(Boolean),
        evidenceGate: 'next_day_revisit_and_safe_handoff'
      },
      {
        id: 'next_service',
        title: 'Next service suggestion',
        body: servicePathway && servicePathway.primaryTier
          ? [servicePathway.primaryTier.label || servicePathway.primaryTier.id || 'family private tutor service']
          : ['7-day homework companion pack', 'wrong-cause repair pack', 'assessment interpretation plus real-task validation'],
        evidenceGate: 'commercial_offer_after_parent_confirmation'
      }
    ],
    aiMaterialAnalysis: aiMaterialAnalysisContract && aiMaterialAnalysisContract.id ? {
      id: aiMaterialAnalysisContract.id,
      endpointPath: aiMaterialAnalysisContract.endpointPath || '',
      releaseGates: Array.isArray(aiMaterialAnalysisContract.releaseGates) ? aiMaterialAnalysisContract.releaseGates.slice(0, 6) : [],
      fallbackStatus: aiMaterialFallback.status || '',
      analysisQuality: aiMaterialFallback.analysisQuality || null,
      normalizedSolution: {
        subject: aiMaterialFallback.subject || 'unknown',
        wrongCause: aiMaterialFallback.wrongCause || 'wrong-cause candidate needs evidence',
        firstStep: aiMaterialFallback.firstStep || 'ask the child to name the first step',
        learningPreference: aiMaterialFallback.learningPreference || 'validate method before practice',
        evidenceConfidence: aiMaterialFallback.evidenceConfidence || { level: 'low' },
        nextAction: aiMaterialFallback.nextAction || { route: '/pages/tutor/tutor?from=solution_book' },
        executionPath: aiMaterialFallback.executionPath || {
          socraticRoute: '/pages/tutor/tutor?from=solution_book_socratic',
          miniLessonRoute: '/pages/tutor/tutor?from=solution_book_mini_lesson',
          gameRecallRoute: '/pages/arcade/arcade?from=solution_book_recall',
          parentReviewRoute: '/pages/profile/profile?from=solution_book_parent'
        }
      }
    } : null,
    commercialLoop: [
      { id: 'partner_upload', route: '/pages/upload/upload?from=partner_material', gate: 'parent_confirmed_material' },
      { id: 'ai_assisted_interpretation', route: '/pages/profile/profile?from=solution_book', gate: 'server_env_key_and_sanitizer' },
      { id: 'product_execution', route: parentDecisionBook.routeActions && parentDecisionBook.routeActions[0] ? parentDecisionBook.routeActions[0].route : '/pages/tutor/tutor?from=solution_book', gate: 'child_first_step' },
      { id: 'parent_report', route: '/pages/profile/profile?from=solution_book_report', gate: 'safe_share_payload' },
      { id: 'service_conversion', route: '/pages/profile/profile?from=solution_book_service', gate: 'evidence_based_offer' }
    ],
    executionPathMap,
    modeChoiceSummary: {
      recommendedModeId,
      recommendedModeLabel: executionPathMap.find((item) => item.recommended)?.label || '',
      releaseGate: modeChoice.releaseGate || 'mode_choice_requires_real_task_evidence',
      positioningLine: modeChoice.positioningLine || '课堂、小课堂、游戏和家长报告都只服务家庭私教闭环。'
    },
    sharePolicy: parentDecisionBook.sharePolicy || {
      allowedFields: ['tonight_action', 'parent_question', 'next_day_revisit_status'],
      blockedFields: ['original_question', 'full_answer', 'score', 'ranking', 'full_dialogue', 'child_name', 'parent_phone', 'parent_wechat', 'contact_info']
    },
    blockedClaims: ['talent_label', 'personality_label', 'auto_grading', 'ocr_claim', 'full_answer', 'ranking', 'guaranteed_improvement'],
    evidenceRequired: ['one_page_diagnosis', 'method_candidates', 'seven_day_action', 'parent_script', 'review_evidence', 'next_service_suggestion', 'execution_path_map', 'safe_share_policy']
  };
}

function buildAiLocalImplementationMatrix(input = {}) {
  const sourceEvidenceLedger = input.sourceEvidenceLedger || {};
  const reportEvidenceReleaseGate = input.reportEvidenceReleaseGate || {};
  const gameReturnEvidence = input.gameReturnEvidence || {};
  const parentDecisionBook = input.parentDecisionBook || {};
  const safeHandoff = reportEvidenceReleaseGate.homeSchoolSafeHandoff || {};
  const blockedFields = Array.from(new Set([]
    .concat(Array.isArray(safeHandoff.blockedFields) ? safeHandoff.blockedFields : [])
    .concat(Array.isArray(gameReturnEvidence.blockedFields) ? gameReturnEvidence.blockedFields : [])
    .concat(['original_question', 'photo', 'full_answer', 'full_dialogue', 'score', 'ranking', 'talent_label'])));
  const rows = [
    {
      id: 'k12_content_scale',
      label: 'K12 内容规模',
      localCodeOwns: ['source_registry_gate', 'chapter_route', 'question_type_axis', 'answer_boundary', 'coverage_audit'],
      aiBetterFor: ['把公开资料结构改写成儿童能懂的第一步问题', '生成同错因的不同中文问法'],
      aiMustNotOwn: ['复制公开资料原文', '生成标准答案库', '声称官方合作或全覆盖'],
      releaseGate: '结构可用，原文/答案/图片不可进入公开小程序卡片。',
      productAction: '继续扩大 source-backed 题型卡，但每张卡必须有来源边界、第一步、错因和回访证据。'
    },
    {
      id: 'socratic_tutoring',
      label: '苏格拉底点拨',
      localCodeOwns: ['direct_answer_guard', 'hint_level', 'stop_condition', 'thinking_receipt', 'report_evidence'],
      aiBetterFor: ['追问语气', '孩子能听懂的解释', '家长低压话术', '小黑板口播'],
      aiMustNotOwn: ['最终答案', 'XP 发放', '掌握判定', '长期画像更新'],
      releaseGate: 'AI 只能在本地安全边界内改写表达；孩子说出第一步前不进入完整讲解。',
      productAction: '用大规模错题/卡点样本压测追问质量，失败时降级到 A/B 微提示。'
    },
    {
      id: 'visual_blackboard',
      label: '第一步小黑板',
      localCodeOwns: ['board_move_type', 'stop_rule', 'unsafe_full_board_block', 'share_safe_fields'],
      aiBetterFor: ['把第一笔画法说得更像老师', '生成不同学科的板书提示文案'],
      aiMustNotOwn: ['全科自动板书承诺', '完整解题过程', '未验证图像推理结论'],
      releaseGate: '只画第一笔、证据点和卡点，不承诺千问式全科动态板书。',
      productAction: '先把物理/化学/地理/数学的第一步图解模板做稳定，再考虑更强视觉生成。'
    },
    {
      id: 'game_retention',
      label: '游戏和间隔回访',
      localCodeOwns: ['review_queue', 'spaced_recall_policy', 'xp_gate', 'daily_return_contract', 'leech_rule'],
      aiBetterFor: ['挑战文案', '鼓励语', '错因卡换一种说法'],
      aiMustNotOwn: ['排行榜刺激', '分数排名', '刷题量奖励', '掌握结论'],
      releaseGate: gameReturnEvidence.releaseGate || 'first_step_and_wrong_cause_before_xp_or_share',
      productAction: '把 XP 绑定第一步、错因复述、次日回访和第 7 天变式，不奖励盲刷数量。'
    },
    {
      id: 'parent_decision_report',
      label: '家长决策报告',
      localCodeOwns: ['portrait_release_gate', 'home_school_allowed_fields', 'blocked_fields', 'next_evidence_queue'],
      aiBetterFor: ['报告摘要', '家长一句话', '老师沟通摘要'],
      aiMustNotOwn: ['天赋定性', '升学判断', '长期掌握结论', '隐私字段放行'],
      releaseGate: reportEvidenceReleaseGate.releaseDecision || 'collect_more_evidence',
      productAction: parentDecisionBook.oneSentenceDecision || '只给今晚行动和下一证据，不把单次表现写成长期结论。'
    },
    {
      id: 'safe_share_relay',
      label: '安全分享接力',
      localCodeOwns: ['allowlist_payload', 'denylist_payload', 'relay_completion', 'privacy_boundary'],
      aiBetterFor: ['分享标题', '挑战钩子', '接收者提示'],
      aiMustNotOwn: ['可分享字段决策', '原题/照片/答案外传', '公开社区排名'],
      releaseGate: '分享只带行动、第一步、错因标签和回访窗口。',
      productAction: '社区化先做安全接力，不做开放题库社区。'
    },
    {
      id: 'talent_and_upload_report',
      label: '天赋测评/错题上传',
      localCodeOwns: ['source_type_classification', 'method_candidate_only', 'score_release_policy', 'required_next_evidence'],
      aiBetterFor: ['把测评结果改写成学习方法候选', '把错题材料摘要成家长能懂的动作'],
      aiMustNotOwn: ['天赋定性', '人格标签', '分数排名刺激', '自动判卷结论'],
      releaseGate: '天赋报告只能生成方法候选，必须用错题、第一步和回访证据交叉验证。',
      productAction: '上传材料先进入证据账本，再生成家庭决策书，不直接生成孩子定性。'
    }
  ];
  return {
    id: 'ai_local_implementation_matrix',
    title: 'AI / 本地代码能力分工矩阵',
    summary: '本地代码负责规则、证据、放行、奖励、隐私和分享；AI 负责高熵表达、追问、小黑板话术和家长摘要。',
    rows,
    rowCount: rows.length,
    localCodeOwns: Array.from(new Set(rows.reduce((list, row) => list.concat(row.localCodeOwns || []), []))).slice(0, 24),
    aiBetterFor: Array.from(new Set(rows.reduce((list, row) => list.concat(row.aiBetterFor || []), []))).slice(0, 20),
    aiMustNotOwn: Array.from(new Set(rows.reduce((list, row) => list.concat(row.aiMustNotOwn || []), []))).slice(0, 24),
    blockedFields,
    sourceUsePolicy: sourceEvidenceLedger.aiBoundary || 'AI 只做摘要、追问和表达改写；不做天赋定性、掌握结论、分数排名或完整答案。',
    productBoundaryLine: '要加厚的是本地可验证闭环；AI 只在本地边界内提升讲解和表达，不替代证据闸。',
    nextBuildOrder: ['次日回访回执', 'Tutor 有效性回执', '公开资料挑战卡入游戏', '安全分享接收测试', '家长报告周/月证据'],
    releaseGate: '任何新能力必须同时说明 localCodeOwns、aiBetterFor、aiMustNotOwn、blockedFields 和 evidenceRequired。'
  };
}

function buildGameReturnEvidence(input = {}) {
  const dailyReturnContract = input.dailyReturnContract || null;
  const reviewReturnSeed = input.reviewReturnSeed || null;
  const spacedRecallPolicy = input.spacedRecallPolicy || null;
  const loop = input.highFrequencyPracticeLoop || {};
  const blockedFields = Array.from(new Set([]
    .concat(dailyReturnContract && dailyReturnContract.shareCard && Array.isArray(dailyReturnContract.shareCard.blockedFields) ? dailyReturnContract.shareCard.blockedFields : [])
    .concat(reviewReturnSeed && Array.isArray(reviewReturnSeed.blockedFields) ? reviewReturnSeed.blockedFields : [])
    .concat(['original_question', 'original_stem_photo', 'full_solution', 'full_dialogue', 'score', 'ranking'])));
  const returnWindows = []
    .concat(dailyReturnContract && Array.isArray(dailyReturnContract.loop) ? dailyReturnContract.loop.map((item) => item.id || item.label).filter(Boolean) : [])
    .concat(spacedRecallPolicy && Array.isArray(spacedRecallPolicy.cadence) ? spacedRecallPolicy.cadence.map((item) => item.id).filter(Boolean) : []);
  const nextDayCardIds = spacedRecallPolicy && Array.isArray(spacedRecallPolicy.nextDayCardIds)
    ? spacedRecallPolicy.nextDayCardIds
    : [];
  return {
    id: 'game_return_evidence',
    status: dailyReturnContract || reviewReturnSeed || spacedRecallPolicy ? 'ready' : 'missing',
    source: 'arcade_review_local_loop',
    weakKey: reviewReturnSeed && reviewReturnSeed.weakKey || dailyReturnContract && dailyReturnContract.weakKey || loop.weakKey || '',
    nextRoute: reviewReturnSeed && reviewReturnSeed.nextRoute || '',
    returnWindows: Array.from(new Set(returnWindows)).slice(0, 8),
    wrongCardIds: reviewReturnSeed && Array.isArray(reviewReturnSeed.wrongCardIds) ? reviewReturnSeed.wrongCardIds.slice(0, 8) : [],
    dueCardIds: reviewReturnSeed && Array.isArray(reviewReturnSeed.dueCardIds) ? reviewReturnSeed.dueCardIds.slice(0, 8) : [],
    nextDayCardIds: nextDayCardIds.slice(0, 8),
    day7Requirement: spacedRecallPolicy && spacedRecallPolicy.day7Check ? spacedRecallPolicy.day7Check.requirement : 'near_transfer_gate_passed',
    releaseGate: spacedRecallPolicy && spacedRecallPolicy.releaseGate || 'first_step_and_wrong_cause_before_xp_or_share',
    allowedFields: ['weak_key', 'first_step_action', 'wrong_cause_label', 'return_window', 'next_day_revisit_status', 'parent_question'],
    blockedFields,
    localCodeOwns: reviewReturnSeed && Array.isArray(reviewReturnSeed.localCodeOwns)
      ? reviewReturnSeed.localCodeOwns
      : ['queue_order', 'xp_gate', 'share_fields', 'report_release', 'review_windows'],
    aiMayRewrite: reviewReturnSeed && Array.isArray(reviewReturnSeed.aiMayRewrite)
      ? reviewReturnSeed.aiMayRewrite
      : ['prompt_copy', 'parent_line'],
    evidenceRequired: ['review_return_seed', 'spaced_recall_policy', 'daily_return_contract', 'safe_share_blocklist']
  };
}

function buildOpenMaicInspiredReportDecisionBridge(input = {}) {
  if (!openMaicInspiredPlanUtils || !openMaicInspiredPlanUtils.buildOpenMaicInspiredTaskPlan || !openMaicInspiredPlanUtils.buildOpenMaicInspiredDecisionBridge) {
    return null;
  }
  const parts = input.parts || {};
  const behaviorSignals = parts.behaviorSignals || {};
  const homeworkPressureContext = input.homeworkPressureContext || {};
  const familyDecisionMemo = input.familyDecisionMemo || {};
  const tonightDecisionBrief = input.tonightDecisionBrief || {};
  const gameReturnEvidence = input.gameReturnEvidence || {};
  const subject = homeworkPressureContext.subject || behaviorSignals.subject || 'current_subject';
  const taskType = input.taskType || behaviorSignals.taskType || homeworkPressureContext.taskType || 'homework_decision_bridge';
  const pressureSignal = Object.assign({
    taskType,
    subject,
    firstStep: homeworkPressureContext.firstStep
      || behaviorSignals.firstStep
      || behaviorSignals.childFirstStep
      || (familyDecisionMemo.decisionCard && familyDecisionMemo.decisionCard.firstStep)
      || tonightDecisionBrief.nextAction
      || '',
    wrongCause: homeworkPressureContext.wrongCause
      || behaviorSignals.wrongCause
      || behaviorSignals.weakPoint
      || (familyDecisionMemo.decisionCard && familyDecisionMemo.decisionCard.cause)
      || '',
    parentCheck: homeworkPressureContext.parentQuestion
      || behaviorSignals.parentQuestion
      || (familyDecisionMemo.parentMeetingScript && familyDecisionMemo.parentMeetingScript[0])
      || '',
    reviewMove: gameReturnEvidence.nextDayReplay
      || gameReturnEvidence.day7Requirement
      || (Array.isArray(gameReturnEvidence.returnWindows) ? gameReturnEvidence.returnWindows[0] : '')
      || ''
  }, input.pressureSignal || {});
  const plan = input.plan || openMaicInspiredPlanUtils.buildOpenMaicInspiredTaskPlan({
    taskType,
    pressureSignal
  });
  const reportSummary = {
    familyDecisionHomepageHeadline: familyDecisionMemo.decisionLine
      || familyDecisionMemo.tonightDecision
      || tonightDecisionBrief.title
      || '',
    familyDecisionHomepageNextLocalAction: tonightDecisionBrief.tonightDo && tonightDecisionBrief.tonightDo[0]
      || familyDecisionMemo.nextAction
      || pressureSignal.firstStep
      || '',
    familyDecisionHomepageShareBoundary: familyDecisionMemo.shareBoundary
      || (tonightDecisionBrief.sharePayload && Array.isArray(tonightDecisionBrief.sharePayload.blocked_fields)
        ? `blocked: ${tonightDecisionBrief.sharePayload.blocked_fields.join(', ')}`
        : '')
  };
  const reviewSummary = {
    nextStep: pressureSignal.reviewMove || pressureSignal.parentCheck || ''
  };
  const bridge = openMaicInspiredPlanUtils.buildOpenMaicInspiredDecisionBridge(
    plan,
    reportSummary,
    reviewSummary,
    gameReturnEvidence
  );
  return Object.assign({}, bridge, {
    sourcePolicy: plan.sourcePolicy || null,
    planId: plan.id || '',
    localCodeOwns: bridge.localAiBoundary && Array.isArray(bridge.localAiBoundary.localCodeOwns)
      ? bridge.localAiBoundary.localCodeOwns
      : [],
    aiMustNotDecide: bridge.localAiBoundary && Array.isArray(bridge.localAiBoundary.aiMustNotDecide)
      ? bridge.localAiBoundary.aiMustNotDecide
      : [],
    evidenceRequired: Array.from(new Set([]
      .concat(Array.isArray(bridge.evidenceList) ? bridge.evidenceList : [])
      .concat(Array.isArray(gameReturnEvidence.evidenceRequired) ? gameReturnEvidence.evidenceRequired : [])
      .concat(['local_report_decision', 'safe_share_boundary']))).filter(Boolean).slice(0, 10),
    productBoundaryLine: 'OpenMAIC 只作为两阶段任务计划和质量门的启发；报告层仍由本地代码决定证据、放行、奖励和分享字段。'
  });
}

function buildFamilyDecisionReportInput(input = {}, parts = {}, parsed = {}) {
  const profileBasics = parts.profileBasics || {};
  const behaviorSignals = parts.behaviorSignals || {};
  const assessment = input.assessmentData || input.assessment || input.talentAssessment || {};
  const parsedScores = parts.parsedScores || {};
  const parsedRanks = parts.parsedRanks || {};
  const sourceEvidence = (parts.reportSources || [])
    .map((source) => safeText(source.label || source.type || source.sourceSchemaLabel || source.id))
    .filter(Boolean);
  const studentName = safeText(
    input.studentName
    || profileBasics.studentName
    || profileBasics.name
    || parsed.studentName
    || ''
  );
  const scoreRecords = asArray(input.scoreRecords).length
    ? asArray(input.scoreRecords)
    : [{
      examName: parsedRanks.examName || input.examName || '待确认考试',
      examDate: parsedRanks.examDate || input.examDate || '',
      totalScore: Number.isFinite(Number(parsedRanks.totalScore)) ? Number(parsedRanks.totalScore) : null,
      classRank: Number.isFinite(Number(parsedRanks.classRank)) ? Number(parsedRanks.classRank) : null,
      gradeRank: Number.isFinite(Number(parsedRanks.totalRank)) ? Number(parsedRanks.totalRank) : null,
      sourceEvidence: sourceEvidence.length ? sourceEvidence : ['上传资料/成绩识别'],
      subjects: Object.keys(parsedScores).map((key) => {
        const item = parsedScores[key] || {};
        return {
          name: item.subject || key,
          score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
          fullScore: Number.isFinite(Number(item.fullScore)) ? Number(item.fullScore) : null,
          classRank: Number.isFinite(Number(item.rank)) ? Number(item.rank) : null,
          trend: item.trend || '',
          sourceEvidence: [item.evidence || item.status || '成绩字段需家长确认'].filter(Boolean)
        };
      })
    }];
  return {
    profile: {
      studentName,
      gender: input.gender || profileBasics.gender || '',
      grade: input.grade || profileBasics.grade || profileBasics.gradeBand || '',
      schoolStage: input.schoolStage || profileBasics.schoolStage || profileBasics.stage || '',
      sourceConfidence: studentName || profileBasics.grade ? 'medium' : 'low',
      missingFields: []
    },
    profileCandidates: asArray(input.profileCandidates),
    assessment: {
      trc: assessment.trc || assessment.TRC || behaviorSignals.trc || '',
      atd: assessment.atd || assessment.ATD || behaviorSignals.atd || '',
      brainPreference: assessment.brainPreference || assessment.brainType || behaviorSignals.brainPreference || '',
      persistenceIndex: assessment.persistenceIndex || assessment.persistence || behaviorSignals.persistenceIndex || '',
      behaviorMode: assessment.behaviorMode || behaviorSignals.behaviorMode || '',
      learningChannel: assessment.learningChannel || assessment.learningStyle || behaviorSignals.learningChannel || '',
      intelligenceRanks: asArray(assessment.intelligenceRanks || assessment.multipleIntelligenceRanks),
      rawEvidence: sourceEvidence
    },
    scoreRecords,
    parentInput: {
      observation: safeText(
        input.parentObservation
        || behaviorSignals.parentObservation
        || behaviorSignals.sourceText
        || input.sourceText
        || ''
      ).slice(0, 500),
      goals: asArray(input.parentGoals || behaviorSignals.parentGoals),
      concerns: asArray(input.parentConcerns || behaviorSignals.parentConcerns),
      sourceEvidence
    },
    teacherInput: {
      observation: safeText(input.teacherObservation || behaviorSignals.teacherObservation || ''),
      sourceEvidence
    }
  };
}

function buildFamilyLearningDecisionReport(input = {}, parts = {}, parsed = {}) {
  if (!familyReportEngine || !familyReportEngine.buildParentDecisionReport) return null;
  const engineInput = buildFamilyDecisionReportInput(input, parts, parsed);
  const report = familyReportEngine.buildParentDecisionReport(engineInput);
  return Object.assign({}, report, {
    engineVersion: 'family-report-engine.v1',
    sourceMode: 'local_guarded_template',
    inputGuard: familyReportEngine.validateReportInputs
      ? familyReportEngine.validateReportInputs(engineInput)
      : null
  });
}

function buildPersonalizedParentReportPreview(input = {}, parts = {}, parsed = {}) {
  if (!personalizedReportTemplate || !personalizedReportTemplate.buildPersonalizedReportModel) return null;
  const engineInput = buildFamilyDecisionReportInput(input, parts, parsed);
  const assessment = engineInput.assessment || {};
  const profile = engineInput.profile || {};
  const modelInput = {
    studentName: profile.studentName || input.studentName || '',
    stage: profile.grade || profile.schoolStage || input.grade || input.stage || '',
    generatedAt: nowIso(input.now).slice(0, 10),
    assessmentProfile: {
      learningChannel: assessment.learningChannel || '待补充学习输入偏好',
      brainPreference: assessment.brainPreference || '待补充信息处理偏好',
      behaviorMode: assessment.behaviorMode || '待补充行为启动方式',
      persistenceIndex: assessment.persistenceIndex || '待补充坚持与节奏信号',
      strengths: []
        .concat(asArray(assessment.intelligenceRanks).slice(0, 3))
        .concat(asArray(input.assessmentStrengths || input.strengths).slice(0, 3))
        .filter(Boolean),
      risks: [
        '测评只作为学习方法候选，不写成固定天赋标签',
        '成绩和排名只用于家庭内部优先级，不用于承诺提分或对外比较',
        '每条建议必须落到今晚动作、明天回访和第 7 天变式验证'
      ]
    },
    scoreRecords: engineInput.scoreRecords
  };
  const model = personalizedReportTemplate.buildPersonalizedReportModel(modelInput);
  const html = personalizedReportTemplate.renderPersonalizedReportHtml(model);
  const standard = buildPersonalizedReportStandard(input, parts, parsed, model, engineInput);
  const preview = {
    id: model.id,
    title: model.title,
    format: 'html_preview_printable_pdf',
    standardId: standard.id,
    standardVersion: standard.version,
    standard,
    model,
    html,
    htmlLength: html.length,
    parentTopLine: model.prioritySubjects && model.prioritySubjects.length
      ? `先看 ${model.prioritySubjects.map((item) => item.name).join(' / ')}，用今晚动作和 7 天回访验证方法是否真的适合。`
      : '先补一份可确认成绩单或错题证据，再生成正式家长报告。',
    prioritySubjects: model.prioritySubjects || [],
    stableSubjects: model.stableSubjects || [],
    methodology: model.methodology || [],
    guardrails: model.guardrails || [],
    routes: Array.from(new Set((model.subjects || []).map((item) => item.route).filter(Boolean))),
    exportPolicy: standard.exportPolicy,
    printRule: standard.exportPolicy.printRule,
    miniappExportLine: standard.exportPolicy.miniappLine
  };
  return preview;
}

function buildPersonalizedReportStandard(input = {}, parts = {}, parsed = {}, model = {}, engineInput = {}) {
  const sources = Array.isArray(parts.reportSources) ? parts.reportSources : [];
  const sourceIds = new Set(sources.map((source) => source.sourceSchemaId || source.type).filter(Boolean));
  const hasScore = Object.keys(parts.parsedScores || {}).length > 0
    || (engineInput.scoreRecords || []).some((record) => Array.isArray(record.subjects) && record.subjects.length);
  const hasQuickAssessment = Array.isArray(parts.assessmentAnswers) && parts.assessmentAnswers.length >= 8;
  const hasTalentReport = sourceIds.has('talent_assessment') || !!(input.assessmentData || input.assessment || input.talentAssessment);
  const hasWrongQuestion = sourceIds.has('wrong_question_paper') || sourceIds.has('wrong_question_photo') || /错题|订正|卡住|第一步/.test(String(input.sourceText || input.scoreText || ''));
  const hasParentObservation = sourceIds.has('parent_report') || !!(input.parentObservation || (parts.behaviorSignals && Object.keys(parts.behaviorSignals).length));
  const collected = [
    hasTalentReport ? 'talent_assessment' : '',
    hasQuickAssessment ? 'quick_questionnaire' : '',
    hasScore ? 'score_sheet' : '',
    hasWrongQuestion ? 'wrong_question' : '',
    hasParentObservation ? 'parent_observation' : ''
  ].filter(Boolean);
  const materialCases = [
    {
      id: 'talent_report_uploaded',
      label: '上传天赋/学习偏好报告',
      when: '已有第三方测评、学习偏好报告或家长上传的 PDF/图片文字摘录。',
      output: '只输出方法候选、潜能释放条件和验证门槛。',
      mustPairWith: ['真实错题第一步', '隔天回访', '第 7 天小变式'],
      blocked: ['固定天赋标签', '人格定性', '升学/提分承诺']
    },
    {
      id: 'no_talent_report_questionnaire',
      label: '没有测评，走 15 题快测',
      when: '家长没有现成报告，或者报告信息不足。',
      output: '用问卷形成学习入口假设，再等待真实作业交叉验证。',
      mustPairWith: ['至少 8 题问卷', '孩子/家长观察', '一条真实学习任务'],
      blocked: ['把问卷当诊断', '直接生成长期画像']
    },
    {
      id: 'score_sheet_only',
      label: '只有成绩单/周测',
      when: '只有分数、排名或学科表现。',
      output: '只给学科优先级和下一证据队列。',
      mustPairWith: ['对应错题', '孩子第一步', '错因命名'],
      blocked: ['排名营销', '保分', '只按分数推荐训练']
    },
    {
      id: 'wrong_question_uploaded',
      label: '上传错题/试卷/订正',
      when: '有错题、订正痕迹、孩子原想法或卡住描述。',
      output: '生成第一步、小黑板、错因卡、隔天回访和轻练习入口。',
      mustPairWith: ['孩子原想法', '卡住第一步', '错因猜测'],
      blocked: ['整题答案', '整卷解析', '替孩子完成作业']
    },
    {
      id: 'mixed_materials',
      label: '多材料混合',
      when: '测评、成绩、错题、学校反馈、家长观察同时存在。',
      output: '统一进入同一份家长 HTML 报告：先决策页，再证据边界，再成绩河流，再方法推理图。',
      mustPairWith: ['证据分级', '材料来源台账', '本地放行门'],
      blocked: ['不同材料互相替代', '把 AI 草案当事实']
    }
  ];
  const selectedCaseIds = materialCases
    .filter((item) => {
      if (item.id === 'talent_report_uploaded') return hasTalentReport;
      if (item.id === 'no_talent_report_questionnaire') return !hasTalentReport;
      if (item.id === 'score_sheet_only') return hasScore && !hasWrongQuestion;
      if (item.id === 'wrong_question_uploaded') return hasWrongQuestion;
      if (item.id === 'mixed_materials') return collected.length >= 3;
      return false;
    })
    .map((item) => item.id);
  return {
    id: 'parent_personalized_report_standard',
    version: '2026-05-24.visible-decision-v1',
    title: '家长个性化学习报告标准',
    visualStandard: {
      firstPages: [
        '封面',
        '家长决策页',
        '测评画像与证据边界',
        '成绩证据河流',
        '方法论推理图'
      ],
      requiredSections: [
        '材料信号',
        '教育学解释',
        '学习动作',
        '验证门槛',
        '今晚/明天/第 7 天闭环'
      ],
      avoidLayout: ['目录前置', '大段 AI 文案', '方框堆叠', '产品先行营销']
    },
    evidenceProtocol: {
      collected,
      selectedCaseIds,
      sourceOfTruth: '本地规则决定证据分级、字段放行、下一步入口和 PDF 导出；AI 只负责解释、追问和家长可读改写。',
      minimumReportEvenWhenSparse: '材料不足时仍输出同一版式，但明确标注“方法候选/待补证据”，不升级长期画像。',
      releaseChain: ['材料分类', '证据等级', '方法假设', '真实任务验证', '7 天回访', '长期画像候选']
    },
    reportSop: {
      intake: '先按材料类型入库：测评/问卷、成绩、错题、学校反馈、家长观察，各自保留来源和放行范围。',
      normalize: '把非标材料统一转成五类字段：孩子优势信号、当前卡点、学科证据、方法候选、下一条待补证据。',
      analyze: '先解释“为什么这个孩子更适合这种学习路径”，再给今晚动作；先客观判断，后自然连接产品入口。',
      validate: '任何测评或问卷结论都必须经过真实任务、隔天回访和第 7 天小变式验证。',
      deliver: '输出同一套 HTML 报告结构；家长确认后再导出 PDF 或进入小程序行动闭环。'
    },
    methodologyBackbone: [
      { id: 'socratic', label: '苏格拉底追问', useWhen: '孩子知道知识点但卡在第一步、不会解释为什么这样做。', evidenceGate: '孩子能说出第一步和判断依据。' },
      { id: 'feynman', label: '费曼复述', useWhen: '孩子会做但讲不清，或家长需要确认是否真懂。', evidenceGate: '孩子能用自己的话讲给家长听。' },
      { id: 'retrieval_spaced', label: '提取练习与间隔复习', useWhen: '当天会、隔天忘，或错题反复出现。', evidenceGate: '次日和第 7 天能不看答案说出关键步骤。' },
      { id: 'dual_coding', label: '图像化/双编码', useWhen: '测评或表现显示更依赖图像、结构、关系图。', evidenceGate: '孩子能把题意画成关系图或流程图。' },
      { id: 'interleaving', label: '交错练习与变式迁移', useWhen: '单题会，换问法就错。', evidenceGate: '第 7 天小变式能迁移同一个方法。' }
    ],
    competitorClosureBenchmarks: [
      {
        id: 'khanmigo_private_tutor',
        benchmark: 'Khanmigo 的强项是苏格拉底式 AI 私教、不给答案、过程可追踪。',
        productAnswer: '原点要把上传报告后的第一步直接送到 AI 私教，只追问第一步、错因和判断依据。',
        route: '/pages/tutor/tutor?from=parent_report_standard',
        evidenceReturn: 'child_first_step + socratic_receipt + no_full_answer'
      },
      {
        id: 'synthesis_game_loop',
        benchmark: 'Synthesis 的强项是把挑战做成游戏化任务，靠参与感和可见进展留住孩子。',
        productAnswer: '原点不做泛娱乐游戏，只在真实错因通过门槛后开放轻练习/回忆挑战。',
        route: '/pages/arcade/arcade?from=parent_report_standard',
        evidenceReturn: 'retrieval_result + xp_gate + parent_receipt'
      },
      {
        id: 'alpha_visible_progress',
        benchmark: 'Alpha School 的强项是高频反馈、个性化节奏和家长能看见的进展。',
        productAnswer: '原点用今晚、明天、第 7 天三个窗口让家长看到方法是否真的有效。',
        route: '/pages/review/review?from=parent_report_standard',
        evidenceReturn: 'next_day_revisit + day7_variant + confidence_update'
      },
      {
        id: 'parent_trust_report',
        benchmark: '多数竞品报告偏数据或练习结果，家长很难知道为什么这个方法适合孩子。',
        productAnswer: '原点报告先讲天赋/材料证据边界，再讲方法匹配，再给产品动作，避免硬营销。',
        route: '/pages/profile/profile?from=parent_report_standard',
        evidenceReturn: 'source_ledger + method_gate + export_policy'
      }
    ],
    miniappOperationalPlan: {
      primarySurface: '小程序先承接上传、摘要、行动闭环；完整 HTML/PDF 走 H5 WebView 或服务端临时文件。',
      lightAppSurface: '轻量 APP 可以复用同一套标准对象：上传材料、生成 HTML、父母确认、打印 PDF、回流行动。',
      nextBuildOrder: [
        '上传页：材料分类和证据门槛',
        '报告页：标准 HTML 报告入口和导出说明',
        '私教页：第一步追问与小课堂补位',
        '复习/游戏页：次日和第 7 天验证',
        '家长页：报告证据、方法匹配、下一动作汇总'
      ],
      blockedShortcut: '不要在小程序内承诺直接解析任意 PDF、直接一键下载 PDF、或把测评报告写成固定天赋结论。'
    },
    materialCases,
    exportPolicy: {
      htmlFirst: true,
      pdfAfterParentReview: true,
      printRule: 'HTML 预览优先；确认后用浏览器或服务端 print/export 转 PDF。',
      miniappLine: '小程序内展示家长摘要与报告入口；完整 HTML/PDF 建议通过服务端生成临时文件或 H5 WebView 打开后打印。',
      blocked: ['在小程序端假装直接解析完整 PDF', '无服务端能力时承诺一键下载 PDF', '把原题照片或隐私字段写进导出文件']
    },
    qualityGates: [
      '不出现固定天赋标签',
      '不承诺提分/保分',
      '不展示原题照片、完整答案、完整对话、联系方式',
      '每条方法必须有验证门槛',
      '材料不足时降级为方法候选'
    ]
  };
}

function buildLearningReportDraft(input = {}) {
  const sources = normalizeReportSources(input);
  const allText = [input.sourceText || '', input.scoreText || ''].concat(sources.map((source) => source.text || '')).join('\n');
  const parsed = parseScoreTableText(allText);
  const profileBasics = normalizeSignals(input.profileBasics || input.basics || {});
  const behaviorSignals = normalizeSignals(input.behaviorSignals || {});
  const emotionSignals = normalizeSignals(input.emotionSignals || {});
  const interestSignals = normalizeSignals(input.interestSignals || {});
  const explicitAnswers = asArray(input.assessmentAnswers || []);
  const assessmentAnswers = explicitAnswers.length ? explicitAnswers : inferAnswersFromText(allText);
  const scoreReleasePolicy = buildScoreReleasePolicy(input, sources, parsed, behaviorSignals);
  const seedParts = {
    reportSources: sources,
    parsedScores: scoreReleasePolicy.parsedScores,
    parsedRanks: scoreReleasePolicy.parsedRanks,
    profileBasics,
    behaviorSignals,
    emotionSignals,
    interestSignals,
    assessmentAnswers,
    scoreReleasePolicy
  };
  const completeness = computeCompleteness(seedParts);
  const parts = Object.assign({}, seedParts, {
    reportCompleteness: completeness
  });
  const homeworkPressureContext = {
    id: 'homework_pressure_context',
    subject: profileBasics.subject || profileBasics.currentSubject || (allText.match(/(数学|语文|英语|物理|化学|生物|地理)/) || [])[1] || '当前学科',
    gradeBand: profileBasics.grade || profileBasics.gradeBand || '当前年级',
    wrongCause: behaviorSignals.homeworkDelay || behaviorSignals.wrongCause || behaviorSignals.weakPoint || '',
    firstStep: behaviorSignals.firstStep || behaviorSignals.childFirstStep || '',
    parentQuestion: behaviorSignals.parentQuestion || '',
    evidenceLine: behaviorSignals.homeworkDelay || behaviorSignals.firstStep
      ? `本次报告绑定真实作业卡点：${behaviorSignals.homeworkDelay || '错因待确认'}；第一步：${behaviorSignals.firstStep || '待孩子说出第一步'}。`
      : '',
    localRule: '真实作业压测字段只作为报告证据和家庭行动入口，不直接生成完整答案或长期定性。'
  };
  const mode = input.mode || (completeness >= 80 ? 'full' : completeness >= 45 ? 'standard' : 'fast');
  const capabilityTendencies = buildTendencies(parts);
  const diagnosisMatrix = buildDiagnosisMatrix(parts);
  const overview = buildOverview(parts, capabilityTendencies, diagnosisMatrix);
  const recommendationPlan = buildRecommendationPlan(parts, diagnosisMatrix);
  const solutionMap = buildSolutionMap(parts, diagnosisMatrix, recommendationPlan);
  const longTermPortrait = buildLongTermLearningPortrait(parts, diagnosisMatrix, capabilityTendencies);
  const classroomDecisionBoard = buildClassroomDecisionBoard(parts, diagnosisMatrix, recommendationPlan, solutionMap);
  const familyDecisionMemo = buildFamilyDecisionMemo(parts, diagnosisMatrix, recommendationPlan, solutionMap, longTermPortrait, classroomDecisionBoard);
  const portraitConfidenceSystem = buildPortraitConfidenceSystem(parts, diagnosisMatrix, longTermPortrait, classroomDecisionBoard, familyDecisionMemo);
  const parentDecisionTrustSystem = buildParentDecisionTrustSystem(parts, diagnosisMatrix, portraitConfidenceSystem, familyDecisionMemo, classroomDecisionBoard);
  const longitudinalPortraitTimeline = buildLongitudinalPortraitTimeline(parts, diagnosisMatrix, longTermPortrait, portraitConfidenceSystem, parentDecisionTrustSystem, familyDecisionMemo);
  const portraitEvidenceMaturitySystem = buildPortraitEvidenceMaturitySystem(parts, portraitConfidenceSystem, parentDecisionTrustSystem, longitudinalPortraitTimeline, familyDecisionMemo);
  const socraticMemoryReportBridge = buildSocraticMemoryReportBridge(input, parentDecisionTrustSystem, portraitConfidenceSystem);
  const questionBankDecisionBridge = buildQuestionBankDecisionBridge(input, parentDecisionTrustSystem, portraitConfidenceSystem);
  const questionBankRecallReportBridge = buildQuestionBankRecallReportBridge(input, parentDecisionTrustSystem, portraitConfidenceSystem);
  const portraitDecisionReleaseSystem = buildPortraitDecisionReleaseSystem(input, parentDecisionTrustSystem, portraitConfidenceSystem, portraitEvidenceMaturitySystem, questionBankRecallReportBridge);
  const crossWeekTrendBoard = buildCrossWeekTrendBoard(parts, diagnosisMatrix, longitudinalPortraitTimeline, portraitEvidenceMaturitySystem, questionBankRecallReportBridge);
  const homeSchoolCollaborationDigest = buildHomeSchoolCollaborationDigest(parts, diagnosisMatrix, classroomDecisionBoard, familyDecisionMemo, crossWeekTrendBoard);
  const homeSchoolConferenceKit = buildHomeSchoolConferenceKit(parts, diagnosisMatrix, homeSchoolCollaborationDigest, crossWeekTrendBoard, parentDecisionTrustSystem);
  const reportEvidenceReleaseGate = buildReportEvidenceReleaseGate(input, portraitDecisionReleaseSystem, crossWeekTrendBoard, homeSchoolCollaborationDigest, homeSchoolConferenceKit, portraitConfidenceSystem, portraitEvidenceMaturitySystem);
  const sourceEvidenceLedger = buildSourceEvidenceLedger(input, parts, familyDecisionMemo, reportEvidenceReleaseGate);
  const servicePathway = input.servicePathway && typeof input.servicePathway === 'object' ? input.servicePathway : null;
  const uploadedMaterialDecisionDossier = buildUploadedMaterialDecisionDossier(input, parts, sourceEvidenceLedger, reportEvidenceReleaseGate, portraitConfidenceSystem, servicePathway);
  const tonightDecisionBrief = buildTonightDecisionBrief(parts, diagnosisMatrix, familyDecisionMemo, parentDecisionTrustSystem, questionBankRecallReportBridge, input.socraticPromptQualityJudge || null);
  const reportGameEvidence = input.gameEvidence || {};
  const reportHighFrequencyLoop = input.highFrequencyPracticeLoop || reportGameEvidence.highFrequencyPracticeLoop || {};
  const dailyReturnContract = input.dailyReturnContract || reportHighFrequencyLoop.dailyReturnContract || null;
  const reviewReturnSeed = input.reviewReturnSeed || reportHighFrequencyLoop.reviewReturnSeed || reportGameEvidence.reviewReturnSeed || null;
  const spacedRecallPolicy = input.spacedRecallPolicy
    || reportHighFrequencyLoop.spacedRecallPolicy
    || (reviewReturnSeed && reviewReturnSeed.spacedRecallPolicy)
    || null;
  const gameReturnEvidence = buildGameReturnEvidence({
    dailyReturnContract,
    reviewReturnSeed,
    spacedRecallPolicy,
    gameEvidence: reportGameEvidence,
    highFrequencyPracticeLoop: reportHighFrequencyLoop
  });
  const openMaicInspiredDecisionBridge = buildOpenMaicInspiredReportDecisionBridge({
    parts,
    homeworkPressureContext,
    familyDecisionMemo,
    tonightDecisionBrief,
    gameReturnEvidence,
    plan: input.openMaicInspiredTaskPlan || reportGameEvidence.openMaicInspiredTaskPlan || null,
    taskType: input.openMaicInspiredTaskType || reportGameEvidence.openMaicInspiredTaskType || null,
    pressureSignal: input.openMaicInspiredPressureSignal || reportGameEvidence.openMaicInspiredPressureSignal || null
  });
  const parentDecisionBook = buildParentDecisionBook({
    familyDecisionMemo,
    tonightDecisionBrief,
    parentDecisionTrustSystem,
    reportEvidenceReleaseGate,
    sourceEvidenceLedger,
    portraitConfidenceSystem,
    servicePathway
  });
  const commercialFamilySolutionBook = buildCommercialFamilySolutionBook({
    parentDecisionBook,
    uploadedMaterialDecisionDossier,
    servicePathway,
    sourceEvidenceLedger,
    reportEvidenceReleaseGate,
    tonightDecisionBrief,
    aiMaterialAnalysisContract: input.aiMaterialAnalysisContract
      || behaviorSignals.aiMaterialAnalysisContract
      || input.realAiMaterialAnalysisContract
      || null
  });
  const aiLocalImplementationMatrix = buildAiLocalImplementationMatrix({
    sourceEvidenceLedger,
    reportEvidenceReleaseGate,
    gameReturnEvidence,
    parentDecisionBook,
    commercialFamilySolutionBook
  });
  const familyLearningDecisionReport = buildFamilyLearningDecisionReport(input, parts, parsed);
  const personalizedParentReportPreview = buildPersonalizedParentReportPreview(input, parts, parsed);
  const missing = missingItems(parts);
  const reportDraft = {
    id: input.id || `learning_report_${String(nowIso(input.now)).slice(0, 10).replace(/-/g, '')}`,
    title: mode === 'fast' ? '快速版学习画像' : mode === 'standard' ? '标准版学习画像' : '完整版学习画像',
    mode,
    overview,
    capabilityTendencies,
    diagnosisMatrix,
    learningStyle: capabilityTendencies.find((item) => item.id === 'style_tendency') || {
      id: 'style_tendency',
      label: '学习风格待确认',
      description: '需要快速测评或更多学习行为记录来判断倾向。',
      evidence: [],
      confidence: '低',
      missing: ['快速测评问卷']
    },
    rootCauses: diagnosisMatrix.map((item) => ({
      subject: item.subject,
      mainCause: item.mainCause,
      secondaryCause: item.secondaryCause,
      evidence: item.evidence,
      confidence: item.confidence,
      missing: item.missing
    })),
    recommendationPlan,
    solutionMap,
    longTermPortrait,
    classroomDecisionBoard,
    familyDecisionMemo,
    portraitConfidenceSystem,
    parentDecisionTrustSystem,
    longitudinalPortraitTimeline,
    portraitEvidenceMaturitySystem,
    socraticMemoryReportBridge,
    questionBankDecisionBridge,
    questionBankRecallReportBridge,
    portraitDecisionReleaseSystem,
    crossWeekTrendBoard,
    homeSchoolCollaborationDigest,
    homeSchoolConferenceKit,
    talentLearningMethodPlan: input.talentLearningMethodPlan || behaviorSignals.talentLearningMethodPlan || null,
    reportEvidenceReleaseGate,
    sourceEvidenceLedger,
    uploadedMaterialDecisionDossier,
    homeworkPressureContext,
    tonightDecisionBrief,
    dailyReturnContract,
    reviewReturnSeed,
    spacedRecallPolicy,
    gameReturnEvidence,
    openMaicInspiredDecisionBridge,
    servicePathway,
    parentDecisionBook,
    commercialFamilySolutionBook,
    aiLocalImplementationMatrix,
    familyLearningDecisionReport,
    personalizedParentReportPreview,
    familyReportQualityCheck: familyLearningDecisionReport ? familyLearningDecisionReport.qualityCheck : null,
    generatedAt: nowIso(input.now),
    missingItems: missing,
    sourceIntegrity: {
      requiresConfirmation: parsed.requiresConfirmation,
      missingFields: parsed.missingFields,
      scoreReleasePolicy,
      unreleasedScoreRankingReference: scoreReleasePolicy.unreleasedScoreRankingReference
    }
  };

  return {
    reportDraft,
    reportSources: sources,
    reportProgress: {
      mode,
      completeness,
      label: `${completeness}% · ${mode === 'fast' ? '快速版' : mode === 'standard' ? '标准版' : '完整版'}`,
      nextAction: missing[0] ? `补充：${missing[0]}` : '可以进入 7 天方案'
    },
    parsedScores: parts.parsedScores,
    parsedRanks: parts.parsedRanks,
    scoreReleasePolicy,
    unreleasedScoreRankingReference: scoreReleasePolicy.unreleasedScoreRankingReference,
    profileBasics,
    behaviorSignals,
    emotionSignals,
    interestSignals,
    assessmentAnswers,
    capabilityTendencies,
    diagnosisMatrix,
    recommendationPlan,
    solutionMap,
    longTermPortrait,
    classroomDecisionBoard,
    familyDecisionMemo,
    portraitConfidenceSystem,
    parentDecisionTrustSystem,
    longitudinalPortraitTimeline,
    portraitEvidenceMaturitySystem,
    socraticMemoryReportBridge,
    questionBankDecisionBridge,
    questionBankRecallReportBridge,
    portraitDecisionReleaseSystem,
    crossWeekTrendBoard,
    homeSchoolCollaborationDigest,
    homeSchoolConferenceKit,
    talentLearningMethodPlan: input.talentLearningMethodPlan || behaviorSignals.talentLearningMethodPlan || null,
    reportEvidenceReleaseGate,
    sourceEvidenceLedger,
    uploadedMaterialDecisionDossier,
    homeworkPressureContext,
    tonightDecisionBrief,
    dailyReturnContract,
    reviewReturnSeed,
    spacedRecallPolicy,
    gameReturnEvidence,
    openMaicInspiredDecisionBridge,
    servicePathway,
    parentDecisionBook,
    commercialFamilySolutionBook,
    aiLocalImplementationMatrix,
    familyLearningDecisionReport,
    personalizedParentReportPreview,
    familyReportQualityCheck: familyLearningDecisionReport ? familyLearningDecisionReport.qualityCheck : null,
    reportCompleteness: completeness,
    reportStatus: {
      state: completeness >= 30 ? 'ready' : 'draft',
      label: completeness >= 80 ? '资料较完整' : completeness >= 45 ? '可生成标准版' : '可生成快速版',
      requiresConfirmation: parsed.requiresConfirmation
    },
    lastSavedAt: nowIso(input.now)
  };
}

function buildQuickAssessmentQuestions() {
  return QUICK_ASSESSMENT_QUESTIONS.map((question, index) => Object.assign({ order: index + 1 }, question));
}

module.exports = {
  SUBJECTS,
  QUICK_ASSESSMENT_QUESTIONS,
  buildQuickAssessmentQuestions,
  parseScoreTableText,
  scoreAssessmentAnswers,
  buildLearningReportDraft,
  buildLongTermLearningPortrait,
  buildClassroomDecisionBoard,
  buildFamilyDecisionMemo,
  buildTonightDecisionBrief,
  buildPortraitConfidenceSystem,
  buildParentDecisionTrustSystem,
  buildLongitudinalPortraitTimeline,
  buildPortraitEvidenceMaturitySystem,
  buildSocraticMemoryReportBridge,
  buildQuestionBankDecisionBridge,
  buildQuestionBankRecallReportBridge,
  buildPortraitDecisionReleaseSystem,
  buildReportEvidenceReleaseGate,
  buildSourceEvidenceLedger,
  buildUploadedMaterialDecisionDossier,
  buildParentDecisionBook,
  buildCommercialFamilySolutionBook,
  buildFamilyDecisionReportInput,
  buildFamilyLearningDecisionReport,
  buildPersonalizedParentReportPreview,
  buildPersonalizedReportStandard,
  buildGameReturnEvidence,
  buildOpenMaicInspiredReportDecisionBridge,
  buildCrossWeekTrendBoard,
  buildHomeSchoolCollaborationDigest,
  buildHomeSchoolConferenceKit,
  normalizeReportSources,
  confidenceLabel
};
