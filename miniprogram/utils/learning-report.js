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
    createdAt: source.createdAt || nowIso()
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
  if ((parts.reportSources || []).some((source) => source.type === 'third_party_assessment' || /测评|画像|学习类型|倾向/.test(source.text || ''))) score += 12;
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
      evidence: [`${subjects[0].subject} ${subjects[0].score} 分${subjects[0].rank ? ` / 班名 ${subjects[0].rank}` : ''}`],
      confidence: confidenceLabel(subjects[0].confidence || 0.62),
      missing: parts.parsedRanks.totalRank ? [] : ['缺少总排名或年级参照']
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
      evidence: [`${item.subject} ${item.score} 分${item.rank ? ` / 班名 ${item.rank}` : ''}`, `已录入均值约 ${Math.round(average * 10) / 10}`],
      confidence: confidenceLabel(item.confidence || 0.58),
      missing: item.rank ? [] : ['缺少该学科排名或最近 3 次趋势']
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
  const seedParts = {
    reportSources: sources,
    parsedScores: Object.assign({}, parsed.parsedScores, input.parsedScores || {}),
    parsedRanks: Object.assign({}, parsed.parsedRanks, input.parsedRanks || {}),
    profileBasics,
    behaviorSignals,
    emotionSignals,
    interestSignals,
    assessmentAnswers
  };
  const completeness = computeCompleteness(seedParts);
  const parts = Object.assign({}, seedParts, {
    reportCompleteness: completeness
  });
  const mode = input.mode || (completeness >= 80 ? 'full' : completeness >= 45 ? 'standard' : 'fast');
  const capabilityTendencies = buildTendencies(parts);
  const diagnosisMatrix = buildDiagnosisMatrix(parts);
  const overview = buildOverview(parts, capabilityTendencies, diagnosisMatrix);
  const recommendationPlan = buildRecommendationPlan(parts, diagnosisMatrix);
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
    generatedAt: nowIso(input.now),
    missingItems: missing,
    sourceIntegrity: {
      requiresConfirmation: parsed.requiresConfirmation,
      missingFields: parsed.missingFields
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
    profileBasics,
    behaviorSignals,
    emotionSignals,
    interestSignals,
    assessmentAnswers,
    capabilityTendencies,
    diagnosisMatrix,
    recommendationPlan,
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
  normalizeReportSources,
  confidenceLabel
};
