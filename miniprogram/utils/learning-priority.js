const DEFAULT_AXES = [
  { key: 'concept', name: '概念理解', score: 68 },
  { key: 'calculation', name: '计算准确', score: 64 },
  { key: 'reading', name: '审题建模', score: 56 },
  { key: 'transfer', name: '迁移应用', score: 52 },
  { key: 'expression', name: '表达复盘', score: 66 },
  { key: 'load', name: '作业负荷', score: 44 }
];

const KEYWORDS = {
  concept: ['概念', '定义', '性质', '公式', '原理', '为什么', '理解'],
  calculation: ['计算', '运算', '化简', '移项', '去括号', '去分母', '符号', '小数', '分数'],
  reading: ['审题', '题意', '条件', '问什么', '单位', '已知', '未知', '关键词'],
  transfer: ['应用', '综合', '压轴', '变式', '迁移', '模型', '行程', '工程', '函数'],
  expression: ['过程', '步骤', '说明', '证明', '表达', '讲清楚', '复盘'],
  load: ['作业', '很多', '来不及', '熬夜', '疲惫', '磨蹭', '效率', '时间']
};

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function scoreFromText(text, key) {
  const t = String(text || '');
  return (KEYWORDS[key] || []).reduce((count, word) => count + (t.indexOf(word) >= 0 ? 1 : 0), 0);
}

function makeEvidence(key, score) {
  const low = score < 55;
  const map = {
    concept: low ? '概念没有稳定落到题目条件里。' : '概念能用，但遇到变式会犹豫。',
    calculation: low ? '符号、移项、分数运算容易丢分。' : '计算基本稳定，需要减少低级失误。',
    reading: low ? '容易漏条件，或误读题目到底在问什么。' : '能抓主要条件，复杂题还要慢一点读。',
    transfer: low ? '换一个题型后，不知道先抓哪条线索。' : '常规迁移可做，综合题还需要拆步骤。',
    expression: low ? '会做不等于能讲清楚，复盘证据不足。' : '能说出步骤，继续训练为什么。',
    load: low ? '作业量和精力不匹配，需要先做最有价值的部分。' : '作业节奏基本可控。'
  };
  return map[key] || '需要继续观察。';
}

function splitHomework(text) {
  const lines = String(text || '')
    .split(/\n|；|;|。/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (lines.length) return lines.slice(0, 24);

  return [
    '数学：方程基础题 8 道',
    '数学：应用题 4 道，写完整过程',
    '语文：阅读理解 1 篇',
    '英语：单词抄写 3 遍',
    '整理今天错题并讲出错因'
  ];
}

function classifyHomework(text, weakPoints, minutes) {
  const availableMinutes = clamp(minutes || 35, 10, 120);
  const weakText = (weakPoints || []).map((point) => point.name || '').join(' ');
  const lines = splitHomework(text);
  const baseMinutes = Math.max(5, Math.round(availableMinutes / Math.max(4, lines.length)));

  const items = lines.map((line, index) => {
    let priority = 30;
    if (/错题|订正|复盘|过程|讲/.test(line)) priority += 28;
    if (/基础|例题|必做|课堂|老师/.test(line)) priority += 18;
    if (/应用|综合|压轴|变式|方程|函数|几何|阅读/.test(line)) priority += 16;
    if (/抄写|机械|摘抄|预习|拓展|选做/.test(line)) priority -= 18;
    if (weakText && weakText.split(/\s+/).some((word) => word && line.indexOf(word.slice(0, 2)) >= 0)) priority += 16;
    priority -= index * 1.5;
    return {
      id: `hw_${index + 1}`,
      text: line,
      score: Math.round(clamp(priority, 0, 100)),
      minutes: baseMinutes,
      reason: reasonForScore(priority)
    };
  }).sort((a, b) => b.score - a.score);

  const total = items.length;
  const mustCount = Math.max(1, Math.round(total * 0.48));
  const skipCount = Math.max(1, Math.round(total * 0.24));
  const mustDo = items.slice(0, mustCount);
  const canSkip = items.slice(total - skipCount);
  const flexible = items.slice(mustCount, total - skipCount);

  return {
    minutes_available: availableMinutes,
    must_do: mustDo,
    flexible,
    can_skip: canSkip,
    rule: '必须做约 40-50%，可以跳过约 20-30%，剩余按精力灵活选择。',
    generated_at: new Date().toISOString()
  };
}

function reasonForScore(score) {
  if (score >= 70) return '命中当前弱点或课堂核心，今晚优先做。';
  if (score >= 45) return '有帮助，但可以按时间和精力取舍。';
  return '低收益或机械重复，跳过不是偷懒，是保护精力。';
}

function buildAssessment(input) {
  const payload = input || {};
  const total = Number(payload.totalScore || 100) || 100;
  const score = clamp(payload.score == null ? 70 : payload.score, 0, total);
  const base = total ? Math.round((score / total) * 100) : 62;
  const text = [
    payload.examText || '',
    payload.homeworkText || '',
    (payload.errors || []).map((item) => [item.question, item.myAnswer, item.correctAnswer].join(' ')).join(' ')
  ].join(' ');

  const axes = DEFAULT_AXES.map((axis) => {
    const penalty = scoreFromText(text, axis.key) * 8;
    const loadPenalty = axis.key === 'load' ? 10 : 0;
    const adjusted = Math.round(clamp(base - penalty - loadPenalty, 18, 94));
    return {
      key: axis.key,
      name: axis.name,
      score: adjusted,
      evidence: makeEvidence(axis.key, adjusted)
    };
  });

  const weakPoints = axes
    .filter((axis) => axis.score < 66)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((axis) => ({
      key: axis.key,
      name: axis.name,
      score: axis.score,
      reason: axis.evidence
    }));

  const finalWeakPoints = weakPoints.length ? weakPoints : axes
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((axis) => ({
      key: axis.key,
      name: axis.name,
      score: axis.score,
      reason: axis.evidence
    }));

  return {
    source: payload.source || 'diagnosis',
    stage: payload.stage || '小学高年级到初中衔接',
    grade: payload.grade || '五年级',
    subject: payload.subject || '数学',
    textbook_version: payload.version || '人教版 MVP',
    score,
    total_score: total,
    axes,
    weak_points: finalWeakPoints,
    homework_plan: classifyHomework(payload.homeworkText || '', finalWeakPoints, payload.minutes || 35),
    positioning: getPositioning(),
    updated_at: new Date().toISOString()
  };
}

function getPositioning() {
  return {
    primary_segment: '小学 4-6 年级，可前置到 3-5 年级',
    validation_segment: '初一初二方法升级验证',
    not_for: '初三短期冲刺和保证提分承诺',
    promise: '不替孩子写作业；先判断今晚哪些值得做，再把关键错因讲清楚、练到位、复盘出来。',
    miniapp_loop: '测评/试卷/作业录入 -> 雷达弱点 -> 作业三分类 -> 原小点只辅导必须做和关键错因'
  };
}

function makeDemoState() {
  const weakPoints = [
    { key: 'transfer', name: '迁移应用', score: 52, reason: '换题型后，不知道先抓哪条线索。' },
    { key: 'reading', name: '审题建模', score: 56, reason: '容易漏条件，或误读题目问法。' },
    { key: 'load', name: '作业负荷', score: 44, reason: '作业量和精力不匹配，需要取舍。' }
  ];
  return {
    source: 'demo',
    stage: '小学高年级到初中衔接',
    grade: '五年级',
    subject: '数学',
    textbook_version: '人教版 MVP',
    axes: DEFAULT_AXES,
    weak_points: weakPoints,
    homework_plan: classifyHomework('', weakPoints, 35),
    positioning: getPositioning(),
    updated_at: new Date().toISOString()
  };
}

module.exports = {
  DEFAULT_AXES,
  buildAssessment,
  classifyHomework,
  getPositioning,
  makeDemoState
};
