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
  calculation: ['计算', '运算', '化简', '移项', '去括号', '符号', '小数', '分数'],
  reading: ['审题', '题意', '条件', '单位', '问什么', '已知', '未知', '关键词'],
  transfer: ['应用', '综合', '变式', '模型', '方程', '函数', '几何', '行程'],
  expression: ['过程', '步骤', '说明', '证明', '表达', '讲清楚', '复盘'],
  load: ['作业', '很多', '来不及', '熬夜', '疲惫', '效率', '时间']
};

const MISCONCEPTION_RULES = [
  {
    id: 'knowledge.formula_wrong.sign_flip',
    name: '符号错误',
    axis: 'calculation',
    pattern: /符号|正负|移项|去括号|负号|加减/,
    drill: '用 2 道小题只检查符号变化，孩子必须说出每一步为什么变号。'
  },
  {
    id: 'skill.reading.missing_condition',
    name: '漏读条件',
    axis: 'reading',
    pattern: /审题|条件|单位|题意|问什么|已知|未知|漏/,
    drill: '先圈已知、未知、单位，再复述题目问什么，3 分钟内完成。'
  },
  {
    id: 'transfer.modeling.equation_setup',
    name: '建模断点',
    axis: 'transfer',
    pattern: /应用题|方程|等量关系|模型|综合|变式/,
    drill: '只写等量关系，不急着算；让孩子解释为什么这样列式。'
  },
  {
    id: 'metacognition.review.missing_cause',
    name: '错因说不清',
    axis: 'expression',
    pattern: /错题|订正|复盘|过程|错因|讲/,
    drill: '用一句话写出错因：我错在什么步骤，下次先检查什么。'
  },
  {
    id: 'load.low_value.repetition',
    name: '低价值重复',
    axis: 'load',
    pattern: /抄写|机械|摘抄|重复|预习|拓展|选做/,
    drill: '先完成高价值任务，重复任务只保留能巩固卡点的部分。'
  }
];

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function countHits(text, key) {
  const value = String(text || '');
  return (KEYWORDS[key] || []).reduce((sum, word) => sum + (value.indexOf(word) >= 0 ? 1 : 0), 0);
}

function detectMisconceptions(text) {
  const value = String(text || '');
  return MISCONCEPTION_RULES
    .filter((rule) => rule.pattern.test(value))
    .map((rule) => ({
      id: rule.id,
      name: rule.name,
      axis: rule.axis,
      suggested_drill: rule.drill
    }));
}

function makeEvidence(key, score, misconceptions) {
  const hit = (misconceptions || []).find((item) => item.axis === key);
  if (hit) return `${hit.name}：${hit.suggested_drill}`;
  const low = score < 55;
  const map = {
    concept: low ? '概念没有稳定落到题目条件里。' : '概念能用，但遇到变式还要慢一点确认。',
    calculation: low ? '符号、移项、分数运算容易丢分。' : '计算基本稳定，重点减少低级失误。',
    reading: low ? '容易漏条件，或误读题目到底在问什么。' : '能抓主要条件，复杂题还要慢读。',
    transfer: low ? '换一种题型后，不知道先抓哪条线索。' : '常规迁移可做，综合题还要拆步骤。',
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

  return (lines.length ? lines : [
    '数学：方程基础题 8 道',
    '数学：应用题 4 道，写完整过程',
    '整理今天错题并说出错因',
    '英语：单词抄写 3 遍'
  ]).slice(0, 24);
}

function reasonForScore(score) {
  if (score >= 70) return '命中当前卡点或课堂核心，今晚优先做。';
  if (score >= 45) return '有帮助，但可以按时间和精力取舍。';
  return '低收益或机械重复，跳过是保护精力。';
}

function evidenceForLine(line, score, weakPoints, index) {
  const misconceptions = detectMisconceptions(line);
  const matchedWeak = (weakPoints || []).find((point) => {
    const name = String(point.name || '');
    return name && line.indexOf(name.slice(0, 2)) >= 0;
  });
  const tags = misconceptions.map((item) => item.name);
  if (/错题|订正|复盘|过程|讲/.test(line)) tags.push('错题复盘');
  if (/基础|例题|必做|课堂|老师/.test(line)) tags.push('课堂核心');
  if (/应用|综合|变式|方程|函数|几何|阅读/.test(line)) tags.push('迁移应用');
  if (/抄写|机械|摘抄|预习|拓展|选做/.test(line)) tags.push('低收益重复');
  if (matchedWeak) tags.push(`关联卡点：${matchedWeak.name}`);
  if (!tags.length) tags.push(index < 2 ? '顺序靠前' : '常规任务');

  return {
    tags: Array.from(new Set(tags)),
    decision: score >= 70
      ? '优先处理，能直接打到当前卡点。'
      : score < 45
        ? '今晚可后置，避免挤占关键任务。'
        : '按今晚精力灵活安排。',
    weak_point: matchedWeak ? {
      key: matchedWeak.key,
      name: matchedWeak.name,
      score: matchedWeak.score
    } : null,
    misconception_tags: misconceptions,
    calibration_key: `${matchedWeak?.key || misconceptions[0]?.axis || 'general'}:${tags[0] || 'task'}`
  };
}

function classifyHomework(text, weakPoints, minutes) {
  const availableMinutes = clamp(minutes || 35, 10, 120);
  const lines = splitHomework(text);
  const weakText = (weakPoints || []).map((item) => item.name || '').join(' ');
  const baseMinutes = Math.max(5, Math.round(availableMinutes / Math.max(4, lines.length)));
  const items = lines.map((line, index) => {
    const misconceptions = detectMisconceptions(line);
    let score = 30;
    const vector = {
      misconception: misconceptions.length ? 24 : 0,
      weak_match: 0,
      core: /基础|例题|必做|课堂|老师/.test(line) ? 18 : 0,
      transfer: /应用|综合|变式|方程|函数|几何|阅读/.test(line) ? 16 : 0,
      review: /错题|订正|复盘|过程|讲/.test(line) ? 28 : 0,
      low_value: /抄写|机械|摘抄|预习|拓展|选做/.test(line) ? -18 : 0,
      order: Math.round(index * -1.5)
    };
    if (weakText && weakText.split(/\s+/).some((word) => word && line.indexOf(word.slice(0, 2)) >= 0)) vector.weak_match = 16;
    score += Object.keys(vector).reduce((sum, key) => sum + vector[key], 0);
    const finalScore = Math.round(clamp(score, 0, 100));
    return {
      id: `hw_${index + 1}`,
      text: line,
      score: finalScore,
      minutes: baseMinutes,
      reason: reasonForScore(score),
      priority_vector: vector,
      evidence: evidenceForLine(line, finalScore, weakPoints, index)
    };
  }).sort((a, b) => b.score - a.score);

  const total = items.length;
  const mustCount = Math.max(1, Math.round(total * 0.48));
  const skipCount = Math.max(1, Math.round(total * 0.24));
  const mustDo = items.slice(0, mustCount);
  const flexible = items.slice(mustCount, total - skipCount);
  const canSkip = items.slice(total - skipCount);
  return {
    minutes_available: availableMinutes,
    must_do: mustDo,
    flexible,
    can_skip: canSkip,
    summary: {
      must_minutes: mustDo.reduce((sum, item) => sum + Number(item.minutes || 0), 0),
      saved_minutes: canSkip.reduce((sum, item) => sum + Number(item.minutes || 0), 0),
      top_reason: mustDo[0]?.reason || '先保住最有帮助的任务',
      misconception_count: items.reduce((sum, item) => sum + (item.evidence.misconception_tags || []).length, 0)
    },
    rule: '必交先做约 40-50%，可以后置约 20-30%，剩余按精力灵活安排。',
    generated_at: new Date().toISOString()
  };
}

function buildWeeklyReview(axes, weakPoints, homeworkPlan) {
  const must = homeworkPlan.must_do || [];
  const skip = homeworkPlan.can_skip || [];
  const weakest = weakPoints[0] || axes.slice().sort((a, b) => a.score - b.score)[0];
  return {
    ai_notice: 'AI 辅助生成，供学习决策参考，不替代老师判断。',
    headline: weakest
      ? `本周先抓“${weakest.name}”，不要平均用力。`
      : '本周先把最有价值的作业做扎实。',
    parent_script: weakest
      ? `先不追求快，先问自己：这道题真正卡在“${weakest.name}”的哪一步？`
      : '今晚先确认必须做任务，做完再考虑加量。',
    focus: must.slice(0, 2).map((item) => item.text),
    load_advice: skip.length
      ? `可后置 ${skip.length} 项低收益任务，预计释放 ${homeworkPlan.summary?.saved_minutes || 0} 分钟。`
      : '今晚任务较集中，建议完成必须做后及时收尾。',
    next_check: '下次复盘只看三件事：必须做是否完成、关键错因是否说清、孩子是否少熬一点。'
  };
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
  const misconceptions = detectMisconceptions(text);

  const axes = DEFAULT_AXES.map((axis) => {
    const adjusted = Math.round(clamp(
      base - countHits(text, axis.key) * 8 - misconceptions.filter((item) => item.axis === axis.key).length * 10 - (axis.key === 'load' ? 10 : 0),
      18,
      94
    ));
    return {
      key: axis.key,
      name: axis.name,
      score: adjusted,
      evidence: makeEvidence(axis.key, adjusted, misconceptions)
    };
  });

  const weakPoints = axes
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((axis) => ({
      key: axis.key,
      name: axis.name,
      score: axis.score,
      reason: axis.evidence
    }));
  const homeworkPlan = classifyHomework(payload.homeworkText || '', weakPoints, payload.minutes || 35);

  return {
    source: payload.source || 'diagnosis',
    stage: payload.stage || '小学高年级到初中衔接',
    grade: payload.grade || '五年级',
    subject: payload.subject || '数学',
    textbook_version: payload.version || '人教版主流版本',
    score,
    total_score: total,
    axes,
    weak_points: weakPoints,
    misconception_profile: misconceptions,
    homework_plan: homeworkPlan,
    weekly_review: buildWeeklyReview(axes, weakPoints, homeworkPlan),
    ai_notice: 'AI 辅助生成，供学习决策参考，不替代老师判断。',
    positioning: getPositioning(),
    updated_at: new Date().toISOString()
  };
}

function getPositioning() {
  return {
    primary_segment: '小学 4-6 年级，优先验证数学作业决策',
    validation_segment: '初一初二方法升级验证',
    not_for: '初三短期冲刺和固定结果承诺',
    promise: '不替孩子写作业；先判断今晚哪些值得做，再把关键错因讲清楚、练到位、复盘出来。',
    miniapp_loop: '作业录入 -> 卡点识别 -> 作业三分类 -> 作业点拨只引导高优先级任务和关键错因'
  };
}

function makeLocalSampleState() {
  const weakPoints = [
    { key: 'transfer', name: '迁移应用', score: 52, reason: '换题型后，不知道先抓哪条线索。' },
    { key: 'reading', name: '审题建模', score: 56, reason: '容易漏条件，或误读题目问法。' },
    { key: 'load', name: '作业负荷', score: 44, reason: '作业量和精力不匹配，需要取舍。' }
  ];
  const homeworkPlan = classifyHomework('', weakPoints, 35);
  return {
    source: 'local_sample',
    stage: '小学高年级到初中衔接',
    grade: '五年级',
    subject: '数学',
    textbook_version: '人教版主流版本',
    axes: DEFAULT_AXES,
    weak_points: weakPoints,
    misconception_profile: [],
    homework_plan: homeworkPlan,
    weekly_review: buildWeeklyReview(DEFAULT_AXES, weakPoints, homeworkPlan),
    ai_notice: 'AI 辅助生成，供学习决策参考，不替代老师判断。',
    positioning: getPositioning(),
    updated_at: new Date().toISOString()
  };
}

module.exports = {
  DEFAULT_AXES,
  buildAssessment,
  buildWeeklyReview,
  classifyHomework,
  detectMisconceptions,
  getPositioning,
  makeLocalSampleState
};
