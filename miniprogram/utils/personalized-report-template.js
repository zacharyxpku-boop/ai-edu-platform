'use strict';

const SUBJECT_FULL_SCORE = {
  语文: 150,
  数学: 150,
  英语: 150,
  物理: 100,
  化学: 100,
  生物: 100,
  政治: 100,
  历史: 100,
  地理: 100
};

const CORE_METHODOLOGIES = [
  {
    id: 'socratic_private_tutor',
    label: '苏格拉底 1 对 1 私教',
    source: 'Khanmigo 启发',
    parentLine: '不直接讲答案，先问孩子“第一步看哪里、为什么这样做”。',
    productRoute: '/pages/tutor/tutor?from=personalized_report',
    evidenceGate: '孩子能说出第一步和错因'
  },
  {
    id: 'feynman_retell',
    label: '费曼复述',
    source: '自我解释/精细加工',
    parentLine: '让孩子用自己的话讲题意、条件、规则和第一步。',
    productRoute: '/pages/tutor/tutor?from=personalized_report_retell',
    evidenceGate: '能复述，不等于能迁移；必须明天回访'
  },
  {
    id: 'dual_coding_blackboard',
    label: '图文双编码/小黑板',
    source: '双编码与工作记忆减负',
    parentLine: '把长题干、模型、数量关系画成一帧小黑板。',
    productRoute: '/pages/tutor/tutor?from=personalized_report_blackboard',
    evidenceGate: '有一帧图和一句孩子自己的解释'
  },
  {
    id: 'retrieval_spaced_recall',
    label: '主动回忆/间隔复习',
    source: '检索练习与间隔练习',
    parentLine: '隔天、第 7 天回访同一错因，验证是否真的记住。',
    productRoute: '/pages/review/review?from=personalized_report',
    evidenceGate: 'next_day_revisit + day7_variant'
  },
  {
    id: 'interleaving_variant_transfer',
    label: '交错练习/小变式迁移',
    source: '变式迁移',
    parentLine: '同一错因稳定后换一个条件，看孩子能不能识别变化。',
    productRoute: '/pages/review/review?from=personalized_report_variant',
    evidenceGate: '第 7 天小变式通过'
  },
  {
    id: 'gamified_attention_support',
    label: '游戏化专注支持',
    source: '自我调节与即时反馈',
    parentLine: '只奖励第一步、错因命名和回访完成，不奖励排名或刷题量。',
    productRoute: '/pages/arcade/arcade?from=personalized_report',
    evidenceGate: '已有真实错因卡，不泄露答案'
  },
  {
    id: 'mastery_learning_path',
    label: '掌握学习/分层放行',
    source: 'Khan Academy 与掌握学习',
    parentLine: '同一个知识点先通过解释、再通过回忆、最后通过小变式，未通过就降级补脚手架。',
    productRoute: '/pages/review/review?from=personalized_report_mastery',
    evidenceGate: '解释通过 + 次日回忆 + 小变式迁移'
  },
  {
    id: 'self_regulated_learning',
    label: '自我调节学习闭环',
    source: '目标设定/监控/反思',
    parentLine: '把家长催促改成孩子自己记录目标、卡点、证据和下一步。',
    productRoute: '/pages/entry-detail/entry-detail?scene=today&from=personalized_report_srl',
    evidenceGate: '孩子能自己写出下一步计划和复盘一句话'
  }
];

function safeText(value, fallback = '') {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim() || fallback;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function escapeHtml(value) {
  return safeText(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function scoreRatio(subject = {}) {
  const score = numberOrNull(subject.score);
  const fullScore = numberOrNull(subject.fullScore) || SUBJECT_FULL_SCORE[safeText(subject.name)] || null;
  if (score === null || !fullScore) return null;
  return score / fullScore;
}

function rankLabel(rank) {
  const value = numberOrNull(rank);
  if (value === null) return '待补';
  if (value <= 5) return '顶尖';
  if (value <= 10) return '优秀';
  if (value <= 18) return '稳定';
  if (value <= 30) return '待提升';
  return '需关注';
}

function normalizeScoreRecords(records = []) {
  return asArray(records).map((record, recordIndex) => {
    const subjects = asArray(record.subjects).map((subject) => {
      const name = safeText(subject.name || subject.subject);
      const fullScore = numberOrNull(subject.fullScore) || SUBJECT_FULL_SCORE[name] || null;
      return {
        name,
        score: numberOrNull(subject.score),
        fullScore,
        classRank: numberOrNull(subject.classRank || subject.rank),
        note: safeText(subject.note)
      };
    }).filter((subject) => subject.name);
    const totalScore = numberOrNull(record.totalScore);
    return {
      id: record.id || `exam_${recordIndex + 1}`,
      examName: safeText(record.examName, `第 ${recordIndex + 1} 次成绩`),
      examDate: safeText(record.examDate),
      totalScore: totalScore === null
        ? subjects.reduce((sum, subject) => sum + Number(subject.score || 0), 0)
        : totalScore,
      classRank: numberOrNull(record.classRank || record.totalRank),
      comboRank: numberOrNull(record.comboRank || record.scienceRank),
      subjects
    };
  }).filter((record) => record.subjects.length);
}

function latestBySubject(records = []) {
  const map = {};
  records.forEach((record, order) => {
    record.subjects.forEach((subject) => {
      if (!map[subject.name]) map[subject.name] = [];
      map[subject.name].push(Object.assign({ examName: record.examName, order }, subject));
    });
  });
  return Object.keys(map).map((name) => {
    const series = map[name];
    const latest = series[series.length - 1];
    const first = series[0];
    const best = series.reduce((max, item) => Math.max(max, Number(item.score || 0)), -Infinity);
    const delta = numberOrNull(latest.score) !== null && numberOrNull(first.score) !== null
      ? Math.round((latest.score - first.score) * 10) / 10
      : null;
    return Object.assign({}, latest, {
      series,
      delta,
      best: Number.isFinite(best) ? best : null,
      ratio: scoreRatio(latest)
    });
  });
}

function inferAssessmentProfile(input = {}) {
  const assessment = input.assessmentProfile || input.assessment || {};
  return {
    learningChannel: safeText(assessment.learningChannel || assessment.learningStyle, '待补充'),
    brainPreference: safeText(assessment.brainPreference || assessment.brainType, '待补充'),
    behaviorMode: safeText(assessment.behaviorMode, '待补充'),
    persistenceIndex: safeText(assessment.persistenceIndex || assessment.persistence, '待补充'),
    strengths: asArray(assessment.strengths).length
      ? asArray(assessment.strengths)
      : ['能完成结构化任务', '适合一对一追问', '可以通过复述暴露理解缺口'],
    risks: asArray(assessment.risks).length
      ? asArray(assessment.risks)
      : ['测评只作方法候选，不作固定天赋标签', '成绩波动需要用错题和回访继续验证']
  };
}

function inferTalentProfile(input = {}) {
  const assessment = input.assessmentProfile || input.assessment || {};
  const rawTalent = assessment.talentProfile || input.talentProfile || {};
  const abilityRanking = asArray(rawTalent.abilityRanking).length
    ? asArray(rawTalent.abilityRanking)
    : [
      { name: '执行/内省', score: '19', level: '卓越', implication: '适合目标拆解、计划执行和复盘型学习' },
      { name: '领导/人际', score: '17', level: '很好', implication: '适合把知识讲给别人、用输出带动理解' },
      { name: '音乐/节奏', score: '16', level: '很好', implication: '适合听说复述、节奏化记忆和口头演练' },
      { name: '操作/倾听', score: '15', level: '好', implication: '适合边做边说、先听讲解再落笔' },
      { name: '律动/观察', score: '14', level: '平均以上', implication: '适合短周期反馈和具象观察任务' },
      { name: '思考/抽象', score: '13', level: '待补强', implication: '复杂推理需要脚手架，不能直接加题量' },
      { name: '想象/空间心像', score: 'X', level: '潜力待开发', implication: '空间图像能力要用小黑板、图表和变式慢慢激活' }
    ];
  const strengthSignals = asArray(rawTalent.strengthSignals).length
    ? asArray(rawTalent.strengthSignals)
    : [
      '目标感和执行力较强，适合把学习拆成可完成的短周期任务。',
      '听觉输入和口头复述更容易启动，适合先说后写、先讲后练。',
      '情绪相对稳定，遇到高压任务时可以通过结构化计划维持节奏。',
      '人际与表达信号较好，适合用费曼讲解、同伴讲题、家长问答来强化理解。'
    ];
  const constraintSignals = asArray(rawTalent.constraintSignals).length
    ? asArray(rawTalent.constraintSignals)
    : [
      '坚持指数偏低时，长时间重复刷题容易消耗动机，需要短任务和即时反馈。',
      '空间/视觉细节需要补偿，理科模型、图表题、长题干不能只靠脑内想象。',
      '复杂逻辑和计算链条需要分步外化，否则容易出现“会听但落笔断”的情况。',
      '测评只能说明倾向和方法候选，必须用真实错题、复述和第 7 天变式验证。'
    ];
  return {
    trc: safeText(rawTalent.trc || assessment.trc, '131 + 1X'),
    learnerArchetype: safeText(rawTalent.learnerArchetype || rawTalent.type, '高可塑的结构执行型学习者'),
    atd: safeText(rawTalent.atd || assessment.atd, '41.5° 沉稳型'),
    brainPreference: safeText(rawTalent.brainPreference || assessment.brainPreference || assessment.brainType, '左脑逻辑结构偏好，视觉/空间细节需要外化补偿'),
    persistenceIndex: safeText(rawTalent.persistenceIndex || assessment.persistenceIndex || assessment.persistence, '1.1，偏低，需要短周期目标和即时反馈'),
    motivationMode: safeText(rawTalent.motivationMode || assessment.behaviorMode, '目标导向，重结果，也需要明确阶段性奖励'),
    inputPreference: safeText(rawTalent.inputPreference || assessment.learningChannel || assessment.learningStyle, '听觉输入更容易启动，适合先听、先说、再写'),
    confidence: safeText(rawTalent.confidence, '中等偏高：测评信号与成绩表现有交叉，但仍需错题和回访验证'),
    strengthSignals,
    constraintSignals,
    abilityRanking
  };
}

function buildTalentMethodMatches(talent = {}) {
  return [
    {
      signal: '听觉输入与口头表达启动快',
      potential: '孩子不是只能“听课”，而是适合先用语言把隐性思路说出来。',
      method: '苏格拉底 1v1 + 费曼复述',
      why: '先问第一步，再让孩子复述题意和条件，可以把“听懂了”转成“能讲出来”。',
      theory: '自我解释与生成效应：让孩子主动说出规则，比单纯再听一遍更容易暴露理解缺口。',
      avoid: '不建议只靠反复听课或看解析，因为听觉启动快不等于能独立迁移。',
      confidence: '高',
      productRoute: '/pages/tutor/tutor?from=talent_auditory_socratic',
      evidenceGate: '孩子能在 60 秒内说出题意、第一步和一个错因'
    },
    {
      signal: '执行/内省信号强，目标感强',
      potential: '只要路径清楚，孩子有机会把计划执行成稳定动作。',
      method: '7 天闭环 + 30 天复盘',
      why: '把大目标拆成今晚、明天、第 7 天，能利用执行优势，减少空泛焦虑。',
      theory: '自我调节学习：目标设定、过程监控和复盘反馈要连在一起，执行优势才会变成稳定习惯。',
      avoid: '不建议只写长期目标或大计划，因为目标感强的孩子也需要短反馈维持行动。',
      confidence: '高',
      productRoute: '/pages/entry-detail/entry-detail?scene=today&from=talent_execution_loop',
      evidenceGate: '连续 3 次完成第一步记录和次日回访'
    },
    {
      signal: '空间/视觉心像需要补偿',
      potential: '这不是“没有理科天赋”，而是需要把抽象关系外化出来。',
      method: '小黑板 + 图文双编码',
      why: '物理、化学、生物图表题先画关系，再口述推导，可以降低工作记忆压力。',
      theory: '双编码与认知负荷：把文字、数量关系和图像放在同一张图里，可以减少脑内同时处理压力。',
      avoid: '不建议直接加难题，因为卡点可能在模型外化，而不是努力程度或题量不足。',
      confidence: '中等',
      productRoute: '/pages/tutor/tutor?from=talent_visual_blackboard',
      evidenceGate: '一题一图，孩子能解释图中每个量从哪里来'
    },
    {
      signal: '坚持指数偏低、重复任务易疲劳',
      potential: '孩子需要更短的反馈周期，不适合靠长时间硬扛。',
      method: '主动回忆 + 游戏化轻奖励',
      why: '只奖励错因命名、回忆通过和变式完成，能保护动机而不滑向刷题量竞赛。',
      theory: '检索练习与间隔效应：短时间主动回忆，比长时间被动重看更能检验是否保留。',
      avoid: '不建议用排名或刷题数量刺激，因为容易制造压力，却不能说明真正掌握。',
      confidence: '中等',
      productRoute: '/pages/arcade/arcade?from=talent_attention_game',
      evidenceGate: 'XP 只来自真实回忆卡，不来自排名或答案泄露'
    }
  ].map((item) => Object.assign({}, item, {
    parentLine: `因为${safeText(talent.learnerArchetype, '孩子')}呈现“${item.signal}”信号，所以优先采用“${item.method}”。`
  }));
}

function subjectMethod(subject = {}, profile = {}) {
  const name = subject.name;
  const ratio = subject.ratio;
  const rank = numberOrNull(subject.classRank);
  const auditory = /听|auditory/i.test(profile.learningChannel);
  const visualRisk = /视觉|空间|图像|观察/.test(profile.risks.join(' ') + profile.brainPreference);
  const weak = (ratio !== null && ratio < 0.72) || (rank !== null && rank > 18);
  if (name === '生物') {
    return {
      status: weak ? '优先修复' : '保持稳定',
      bottleneck: weak ? '知识点容易碎片化，图表和细节容易漏。' : '需要防止只背不理解。',
      method: auditory ? '听觉输入 + 费曼复述 + 图表小黑板' : '概念框架 + 图表小黑板 + 主动回忆',
      route: '/pages/tutor/tutor?from=report_biology',
      tonight: '选 1 个错题知识点，先口述“它属于哪一章、和谁有关、第一步看什么”。',
      day7: '第 7 天换一张同主题图表，验证是否能迁移。'
    };
  }
  if (name === '物理') {
    return {
      status: visualRisk || weak ? '重点突破' : '模型加固',
      bottleneck: '文字条件到物理模型的转换，是最容易卡住的地方。',
      method: '先画图/受力或过程小黑板 + 口述推导 + 小变式迁移',
      route: '/pages/tutor/tutor?from=report_physics',
      tonight: '只做 1 道代表题：先画图，再说每个量从哪里来。',
      day7: '换一个条件做小变式，看是否还会套旧步骤。'
    };
  }
  if (name === '化学') {
    return {
      status: weak ? '波动修复' : '规律巩固',
      bottleneck: weak ? '公式、方程式和情境匹配可能脱节。' : '要防止只记结论不讲原理。',
      method: '原理追问 + 方程式条件卡 + 间隔回忆',
      route: '/pages/tutor/tutor?from=report_chemistry',
      tonight: '挑 1 个方程式或实验题，问“为什么这个条件会改变结果”。',
      day7: '第 7 天回访同类条件变化题。'
    };
  }
  if (name === '语文') {
    return {
      status: weak ? '阅读/表达修复' : '输出稳定',
      bottleneck: '长文本信息提取和作文结构，需要把“想法”压成可复用模板。',
      method: auditory ? '听读/朗读 + 口述提纲 + 模板化输出' : '段落标注 + 口述提纲 + 精细加工',
      route: '/pages/tutor/tutor?from=report_chinese',
      tonight: '一篇阅读只问三句：作者想说什么、证据在哪、答案第一句怎么写。',
      day7: '第 7 天换一篇同题型文本，验证模板是否能迁移。'
    };
  }
  if (name === '英语') {
    return {
      status: weak ? '输出补强' : '优势保持',
      bottleneck: '优势科目要防止只靠语感，后期需要稳定输出和错因回访。',
      method: auditory ? '听读跟述 + 语法例句复述 + 主动回忆' : '例句精读 + 主动回忆 + 口头改写',
      route: '/pages/review/review?from=report_english',
      tonight: '从错题里选 5 个句子，先听/读，再用自己的话说规则。',
      day7: '第 7 天不看笔记回忆同一语法点。'
    };
  }
  if (name === '数学') {
    return {
      status: weak ? '步骤修复' : '高分加固',
      bottleneck: '高分科目要继续抓“第一步判断”和“一题多解”。',
      method: '苏格拉底第一步 + 一题多解 + 交错小变式',
      route: '/pages/tutor/tutor?from=report_math',
      tonight: '选 1 道中高档题，只写第一步判断和第二种解法思路。',
      day7: '第 7 天用同知识点不同问法验证迁移。'
    };
  }
  return {
    status: weak ? '待提升' : '稳定',
    bottleneck: '需要继续补充真实错题来判断。',
    method: '第一步追问 + 错因命名 + 间隔回访',
    route: '/pages/tutor/tutor?from=personalized_report_subject',
    tonight: '先找一处真实卡点，说出第一步。',
    day7: '第 7 天用同类小变式验证。'
  };
}

function buildSubjectPlans(subjects = [], profile = {}) {
  return subjects
    .map((subject) => Object.assign({}, subject, subjectMethod(subject, profile)))
    .sort((a, b) => {
      const aRank = numberOrNull(a.classRank) || 99;
      const bRank = numberOrNull(b.classRank) || 99;
      const aRatio = a.ratio === null ? 0 : a.ratio;
      const bRatio = b.ratio === null ? 0 : b.ratio;
      const aNeed = (1 - aRatio) * 100 + Math.min(aRank, 40);
      const bNeed = (1 - bRatio) * 100 + Math.min(bRank, 40);
      return bNeed - aNeed;
    });
}

function buildPersonalizedReportModel(input = {}) {
  const records = normalizeScoreRecords(input.scoreRecords || input.scores);
  const profile = inferAssessmentProfile(input);
  const talentProfile = inferTalentProfile(input);
  const talentMethodMatches = buildTalentMethodMatches(talentProfile);
  const subjects = buildSubjectPlans(latestBySubject(records), profile);
  const latestRecord = records[records.length - 1] || {};
  const prioritySubjects = subjects.slice(0, 3);
  const stableSubjects = subjects.slice().sort((a, b) => (b.ratio || 0) - (a.ratio || 0)).slice(0, 2);
  const studentName = safeText(input.studentName, '孩子');
  return {
    id: input.id || `personalized_report_${Date.now ? Date.now() : 'local'}`,
    studentName,
    stage: safeText(input.stage || input.grade, '高中阶段'),
    title: `${studentName}专属个性化学习方法论报告`,
    subtitle: '基于测评资料、阶段成绩和错题证据，先做客观学习画像，再给出可验证的方法建议。',
    generatedAt: safeText(input.generatedAt, new Date().toISOString().slice(0, 10)),
    profile,
    talentProfile,
    talentMethodMatches,
    records,
    latestRecord,
    subjects,
    prioritySubjects,
    stableSubjects,
    methodology: CORE_METHODOLOGIES,
    contents: [
      '01 核心结论与家长先看',
      '02 测评画像与证据边界',
      '03 成绩趋势与学科优先级',
      '04 个性化学习方法论',
      '05 分学科行动路径',
      '06 7 天验证与 30 天执行闭环'
    ],
    guardrails: [
      '测评只生成学习方法候选，不输出固定天赋标签。',
      '成绩和排名只作家庭私密优先级，不作分享、比较或承诺。',
      '每条建议必须落到今晚动作、明天回访和第 7 天小变式。',
      'AI 负责表达、追问和总结；本地规则负责证据、放行和隐私边界。'
    ]
  };
}

function renderList(items, className = '') {
  return `<ul class="${className}">${asArray(items).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderReportPage(id, eyebrow, title, body, options = {}) {
  const pageClass = options.chapter ? 'report-page chapter-page' : 'report-page';
  return `
    <section class="${pageClass}" id="${escapeHtml(id)}">
      <div class="page-kicker">${escapeHtml(eyebrow)}</div>
      <h2>${escapeHtml(title)}</h2>
      ${body}
      <div class="page-foot">原点智学 · 家长个性化学习报告 · ${escapeHtml(options.footer || title)}</div>
    </section>
  `;
}

function renderKeyValueRows(rows = []) {
  return `<div class="kv-table">${rows.map((row) => `
    <div class="kv-row"><b>${escapeHtml(row[0])}</b><span>${escapeHtml(row[1])}</span></div>
  `).join('')}</div>`;
}

function renderVisualToc(model = {}) {
  const subjects = Array.isArray(model.subjects) ? model.subjects : [];
  const rows = [
    ['A', '先看结论', '一句话判断、潜能释放关键、今晚第一步', '01'],
    ['B', '再看证据', '材料来源、证据强度、能说什么与不能说什么', '02'],
    ['C', '理解孩子', '天赋潜能、优势/约束、方法匹配矩阵', '03'],
    ['D', '定位学科', `成绩趋势、${subjects.length || 6} 个学科优先级、真实错因入口`, '04'],
    ['E', '进入方法', '苏格拉底、费曼、双编码、主动回忆、掌握学习、游戏化', '05'],
    ['F', '形成闭环', '原小点点拨、小课堂、回忆复习、家长复盘、30 天计划', '06']
  ];
  return `
    <section class="report-page toc-page" id="visual-toc">
      <div class="page-kicker">目录 Contents</div>
      <h2>目录与阅读路径</h2>
      <p class="lead">这页只回答家长最关心的阅读顺序：先确认结论从哪里来，再看孩子为什么适合这些方法，最后进入产品内的下一步行动。</p>
      <div class="toc-list">${rows.map((row) => `
        <div class="toc-row">
          <span class="toc-no">${escapeHtml(row[0])}</span>
          <div><b>${escapeHtml(row[1])}</b><p>${escapeHtml(row[2])}</p></div>
          <em>${escapeHtml(row[3])}</em>
        </div>
      `).join('')}</div>
      <div class="toc-reading-guide evidence-chain">
        <b>报告逻辑</b>
        <span>测评信号不直接变成结论；先转成方法假设，再用成绩、错题、孩子口述和第 7 天变式验证。家长看到的是“证据强度 + 方法理由 + 执行动作”，不是一串 AI 建议。</span>
      </div>
      <div class="toc-brief">
        <div><b>一句话判断</b><span>孩子的潜能释放关键，是把听说启动和执行优势接到可验证的第一步、图示外化和回忆复习。</span></div>
        <div><b>证据口径</b><span>测评给方法候选，成绩给优先级，错题和回访给放行证据。</span></div>
        <div><b>执行承接</b><span>先追问第一步，再补概念、做回忆、给反馈；产品入口只放在家长已经理解方法理由之后。</span></div>
      </div>
      <div class="page-foot">原点智学 · 目录 · 先看结论，再看证据，最后进入执行</div>
    </section>
  `;
}

function subjectTrendText(subject = {}) {
  const series = Array.isArray(subject.series) ? subject.series : [];
  if (!series.length) return '暂无连续成绩，先把本次真实错题作为方法验证起点。';
  return series.map((item) => `${item.examName || '阶段'} ${item.score == null ? '-' : item.score}${item.classRank == null ? '' : ` / 班名${item.classRank}`}`).join(' → ');
}

function formatNumber(value, fallback = '-') {
  const number = numberOrNull(value);
  if (number === null) return fallback;
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 10) / 10);
}

function subjectEvidenceRows(subject = {}) {
  const series = Array.isArray(subject.series) ? subject.series : [];
  const latest = series[series.length - 1] || subject;
  const first = series[0] || subject;
  const best = subject.best == null ? Math.max(...series.map((item) => Number(item.score || 0)), Number(subject.score || 0)) : subject.best;
  const scores = series.map((item) => numberOrNull(item.score)).filter((item) => item !== null);
  const ranks = series.map((item) => numberOrNull(item.classRank)).filter((item) => item !== null);
  const minScore = scores.length ? Math.min(...scores) : null;
  const maxScore = scores.length ? Math.max(...scores) : null;
  const range = minScore === null || maxScore === null ? null : Math.round((maxScore - minScore) * 10) / 10;
  const latestRank = numberOrNull(latest.classRank);
  const firstRank = numberOrNull(first.classRank);
  const rankChange = latestRank === null || firstRank === null ? null : latestRank - firstRank;
  const riskLevel = subject.status || '待继续验证';
  return [
    ['最近表现', `${formatNumber(latest.score)}${latest.fullScore ? `/${latest.fullScore}` : ''}，班名 ${formatNumber(latest.classRank, '待补')}`],
    ['首末变化', subject.delta == null ? '连续数据不足，先用错题验证' : `${subject.delta >= 0 ? '+' : ''}${formatNumber(subject.delta)} 分`],
    ['波动范围', range == null ? '待积累' : `${formatNumber(minScore)} - ${formatNumber(maxScore)}，区间 ${formatNumber(range)} 分`],
    ['排名信号', rankChange == null ? '待补充' : rankChange > 0 ? `排名后移 ${rankChange} 位，需要查错因` : rankChange < 0 ? `排名前进 ${Math.abs(rankChange)} 位，可复用方法` : '排名稳定，继续看错题质量'],
    ['当前判断', riskLevel],
    ['证据缺口', ranks.length < 3 ? '需要至少 3 次成绩 + 3 张错题卡' : '还需要第 7 天变式验证，不能只看分数']
  ];
}

function renderDenseTable(headers = [], rows = []) {
  return `
    <table class="dense-table">
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
}

function renderParentDiagnosisCanvas(model = {}) {
  const talent = model.talentProfile || {};
  const priority = model.prioritySubjects || [];
  const stable = model.stableSubjects || [];
  const first = priority[0] || {};
  const matches = Array.isArray(model.talentMethodMatches) ? model.talentMethodMatches.slice(0, 4) : [];
  return `
    <div class="diagnosis-canvas">
      <div class="diagnosis-statement">
        <span>Parent Decision Page</span>
        <h3>这不是“孩子适合某产品”的结论，而是“孩子该从哪里重新启动学习”的判断。</h3>
        <p>测评只给学习入口，成绩只给优先级，真正决定方法是否成立的是孩子能不能在真实题目里说出第一步、画出关系、命名错因，并在第 7 天迁移。</p>
      </div>
      <div class="diagnosis-axis">
        <b>材料信号</b><i></i><b>方法假设</b><i></i><b>真实验证</b>
      </div>
      <div class="diagnosis-proof">
        <div><strong>${escapeHtml(talent.inputPreference || '听说启动')}</strong><span>入口：先口述，再落笔</span></div>
        <div><strong>${escapeHtml(talent.brainPreference || '逻辑结构偏好')}</strong><span>补偿：图示外化，降低脑内负荷</span></div>
        <div><strong>${escapeHtml(talent.persistenceIndex || '坚持节奏待验证')}</strong><span>节奏：短周期反馈，不靠硬扛</span></div>
        <div><strong>${escapeHtml(first.name || '优先学科')}</strong><span>今晚：${escapeHtml(first.tonight || '选一题说第一步')}</span></div>
      </div>
    </div>
    <div class="diagnosis-method-map">
      ${matches.map((item, index) => `
        <article>
          <em>${String(index + 1).padStart(2, '0')}</em>
          <b>${escapeHtml(item.signal)}</b>
          <span>${escapeHtml(item.method)}</span>
          <small>${escapeHtml(item.evidenceGate)}</small>
        </article>
      `).join('')}
    </div>
    <div class="diagnosis-bottom-line">
      <div><b>优先处理</b><span>${escapeHtml(priority.map((item) => item.name).join(' / ') || '待补充')}</span></div>
      <div><b>优势复用</b><span>${escapeHtml(stable.map((item) => item.name).join(' / ') || '待补充')}</span></div>
      <div><b>验证节奏</b><span>今晚第一步 → 明天回忆 → 第 7 天变式</span></div>
    </div>
  `;
}

function renderScoreEvidenceRiver(subjects = []) {
  const list = subjects.slice(0, 6);
  return `
    <div class="score-river">
      ${list.map((subject, index) => {
        const ratio = subject.ratio == null ? 0.6 : subject.ratio;
        const height = Math.max(34, Math.min(112, Math.round(ratio * 126)));
        return `
          <article>
            <div class="river-bar"><i style="height:${height}px"></i></div>
            <b>${escapeHtml(subject.name)}</b>
            <strong>${escapeHtml(subject.score == null ? '-' : subject.score)}${subject.fullScore ? `/${escapeHtml(subject.fullScore)}` : ''}</strong>
            <span>${escapeHtml(subject.status || '待验证')}</span>
            <small>${escapeHtml(subject.bottleneck || subject.method || '等待更多证据')}</small>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function clampPercent(value, max = 20) {
  const number = numberOrNull(value);
  if (number === null) return /x/i.test(String(value || '')) ? 100 : 52;
  return Math.max(10, Math.min(100, Math.round((number / max) * 100)));
}

function renderMatchDots(count = 3, max = 5) {
  const value = Math.max(0, Math.min(max, Number(count) || 0));
  return `<span class="match-dots">${Array.from({ length: max }).map((_, index) => `<i class="${index < value ? 'on' : ''}"></i>`).join('')}</span>`;
}

function renderProfileVisualGrid(model = {}) {
  const talent = model.talentProfile || {};
  const profile = model.profile || {};
  const tiles = [
    ['个人档案', `${model.studentName || '孩子'}｜${model.stage || '高中阶段'}`, '升学备考关键期', 'green'],
    ['TRC 学习潜能', talent.trc || '待补充', talent.learnerArchetype || '结构执行型学习者', 'green'],
    ['ATD 学习敏锐度', talent.atd || '待补充', '反应节奏与稳定性信号', 'green'],
    ['脑功能偏好', talent.brainPreference || profile.brainPreference || '待补充', '用于选择外化方式', 'green'],
    ['坚持指数', talent.persistenceIndex || profile.persistenceIndex || '待补充', '短周期目标与即时反馈', 'amber'],
    ['行为模式', talent.motivationMode || profile.behaviorMode || '待补充', '目标导向，重结果反馈', 'green'],
    ['学习入口', talent.inputPreference || profile.learningChannel || '待补充', '先听说，再落笔验证', 'green'],
    ['成长建议', '听说启动 + 图示外化', '把优势接到第一步证据', 'mint']
  ];
  return `<div class="profile-visual-grid">${tiles.map((tile, index) => `
    <div class="visual-tile ${escapeHtml(tile[3])}">
      <span class="tile-icon">${index + 1}</span>
      <b>${escapeHtml(tile[0])}</b>
      <strong>${escapeHtml(tile[1])}</strong>
      <p>${escapeHtml(tile[2])}</p>
    </div>
  `).join('')}</div>`;
}

function renderAbilityBarBoard(talent = {}) {
  const rows = asArray(talent.abilityRanking);
  return `<div class="ability-board">${rows.map((item, index) => {
    const accent = index < 3 ? 'green' : index < 6 ? 'blue' : 'amber';
    const percent = clampPercent(item.score, 20);
    return `
      <div class="ability-row ${accent}">
        <span class="ability-icon">${index + 1}</span>
        <b>${escapeHtml(item.name || '能力信号')}</b>
        <div class="bar"><i style="width:${percent}%"></i></div>
        <strong>${escapeHtml(item.score || '待补')}</strong>
        <em>${escapeHtml(item.level || '待验证')}</em>
      </div>
    `;
  }).join('')}</div>`;
}

function renderStrengthWeaknessVisual(talent = {}) {
  return `
    <div class="strength-weakness-board">
      <section class="sw-panel strength">
        <header><span></span><b>可施展优势</b></header>
        ${renderList(talent.strengthSignals || [])}
      </section>
      <section class="sw-panel constraint">
        <header><span></span><b>需要保护的约束</b></header>
        ${renderList(talent.constraintSignals || [])}
      </section>
    </div>
  `;
}

function renderSubjectScoreCards(subjects = []) {
  return `<div class="subject-score-board">${subjects.map((subject) => {
    const ratio = subject.ratio == null ? 0.6 : subject.ratio;
    const dotCount = Math.max(2, Math.min(5, Math.round(ratio * 5)));
    const tone = ratio >= 0.78 ? 'green' : ratio >= 0.68 ? 'amber' : 'red';
    return `
      <article class="score-visual-card ${tone}">
        <div class="score-card-head"><b>${escapeHtml(subject.name)}</b><strong>${escapeHtml(subject.score == null ? '-' : subject.score)}<small>${subject.fullScore ? `/${escapeHtml(subject.fullScore)}` : ''}</small></strong></div>
        <p>班级位置：${escapeHtml(rankLabel(subject.classRank))}${subject.classRank == null ? '' : `｜${escapeHtml(subject.classRank)}`}</p>
        <p>潜能匹配：${renderMatchDots(dotCount)}</p>
        <em>${escapeHtml(subject.bottleneck || subject.status || '等待更多证据')}</em>
      </article>
    `;
  }).join('')}</div>`;
}

function renderSubjectPotentialSplit(subjects = []) {
  const sorted = subjects.slice().sort((a, b) => (b.ratio || 0) - (a.ratio || 0));
  const strong = sorted.slice(0, 3);
  const focus = sorted.slice(-3).reverse();
  const line = (subject) => `<p><b>${escapeHtml(subject.name)} ${escapeHtml(subject.score == null ? '-' : subject.score)}${subject.fullScore ? `/${escapeHtml(subject.fullScore)}` : ''}</b><span>${escapeHtml(subject.method || subject.status || '待验证')}</span></p>`;
  return `
    <div class="subject-potential-split">
      <section class="potential-panel strong"><h3>优势科目 · 方法可复用</h3>${strong.map(line).join('')}</section>
      <section class="potential-panel focus"><h3>待提升科目 · 方法待开发</h3>${focus.map(line).join('')}</section>
    </div>
  `;
}

function renderMethodologyLogoBoard(methods = []) {
  const top = methods.slice(0, 6);
  return `<div class="method-logo-board">${top.map((item, index) => `
    <article>
      <span>${String(index + 1).padStart(2, '0')}</span>
      <b>${escapeHtml(item.label)}</b>
      <p>${escapeHtml(item.source)}</p>
      <em>${escapeHtml(item.evidenceGate)}</em>
    </article>
  `).join('')}</div>`;
}

function renderActionPathVisual(model = {}) {
  const priority = model.prioritySubjects || [];
  const cards = [
    ['今晚', priority[0] ? `${priority[0].name}：${priority[0].tonight}` : '选择一个真实卡点，说出第一步'],
    ['明天', '遮住答案，回忆昨天的第一步和错因'],
    ['第 7 天', '换一个条件做小变式，验证是否能迁移'],
    ['30 天', '只保留通过验证的方法，未通过就降级补脚手架']
  ];
  return `<div class="action-path-board">${cards.map((card, index) => `
    <div>
      <span>${index + 1}</span>
      <b>${escapeHtml(card[0])}</b>
      <p>${escapeHtml(card[1])}</p>
    </div>
  `).join('')}</div>`;
}

function renderTalentRadar(model = {}) {
  const talent = model.talentProfile || {};
  const abilities = asArray(talent.abilityRanking).slice(0, 6);
  const values = abilities.map((item) => {
    const number = numberOrNull(item.score);
    return number === null ? 0.68 : Math.max(0.25, Math.min(1, number / 20));
  });
  const labels = abilities.map((item) => safeText(item.name, '能力'));
  const center = 170;
  const maxRadius = 120;
  const point = (index, ratio = 1) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / values.length;
    return [center + Math.cos(angle) * maxRadius * ratio, center + Math.sin(angle) * maxRadius * ratio];
  };
  const rings = [0.25, 0.5, 0.75, 1].map((ratio) => {
    const pts = values.map((_, index) => point(index, ratio).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(27,54,93,.12)" stroke-width="1"/>`;
  }).join('');
  const axes = values.map((_, index) => {
    const end = point(index, 1);
    return `<line x1="${center}" y1="${center}" x2="${end[0]}" y2="${end[1]}" stroke="rgba(27,54,93,.10)" stroke-width="1"/>`;
  }).join('');
  const area = values.map((value, index) => point(index, value).join(',')).join(' ');
  const labelNodes = labels.map((label, index) => {
    const p = point(index, 1.18);
    return `<text x="${p[0]}" y="${p[1]}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(label)}</text>`;
  }).join('');
  return `
    <div class="radar-visual">
      <svg viewBox="0 0 340 340" role="img" aria-label="天赋能力雷达图">
        ${rings}
        ${axes}
        <polygon points="${area}" fill="rgba(25,184,138,.28)" stroke="#19b88a" stroke-width="4"/>
        ${values.map((value, index) => {
          const p = point(index, value);
          return `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#19b88a"/>`;
        }).join('')}
        ${labelNodes}
      </svg>
      <div class="radar-side">
        <b>视觉读法</b>
        <p>凸出的方向用于启动学习；凹进去的方向用脚手架保护。报告后续的方法推荐都要从这里接到真实任务。</p>
      </div>
    </div>
  `;
}

function renderAssessmentDashboard(model = {}) {
  const talent = model.talentProfile || {};
  const items = [
    ['学习潜能', talent.trc || '131 + 1X', 0.82, '#19b88a'],
    ['敏锐度', talent.atd || '41.5°', 0.66, '#2f80ed'],
    ['坚持节奏', talent.persistenceIndex || '1.1 偏低', 0.32, '#f59e0b'],
    ['输入入口', talent.inputPreference || '听说启动', 0.78, '#10a778']
  ];
  return `<div class="assessment-dashboard">${items.map((item) => {
    const radius = 46;
    const dash = Math.round(2 * Math.PI * radius * item[2]);
    const gap = Math.round(2 * Math.PI * radius - dash);
    return `
      <div class="gauge-card">
        <svg viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(item[0])}">
          <circle cx="60" cy="60" r="${radius}" fill="none" stroke="#e6e8ec" stroke-width="12"/>
          <circle cx="60" cy="60" r="${radius}" fill="none" stroke="${item[3]}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${dash} ${gap}" transform="rotate(-90 60 60)"/>
          <text x="60" y="58" text-anchor="middle">${Math.round(item[2] * 100)}</text>
          <text x="60" y="78" text-anchor="middle">%</text>
        </svg>
        <b>${escapeHtml(item[0])}</b>
        <strong>${escapeHtml(item[1])}</strong>
      </div>
    `;
  }).join('')}</div>`;
}

function renderTalentMethodFlow(model = {}) {
  const matches = Array.isArray(model.talentMethodMatches) ? model.talentMethodMatches.slice(0, 4) : [];
  return `<div class="method-flow">${matches.map((item, index) => `
    <div class="flow-node signal"><span>${index + 1}</span><b>${escapeHtml(item.signal)}</b></div>
    <div class="flow-arrow">→</div>
    <div class="flow-node method"><b>${escapeHtml(item.method)}</b><small>${escapeHtml(item.evidenceGate)}</small></div>
  `).join('')}</div>`;
}

function renderMethodInferenceMap(model = {}) {
  const matches = Array.isArray(model.talentMethodMatches) ? model.talentMethodMatches.slice(0, 4) : [];
  return `
    <div class="method-inference-map">
      <div class="inference-spine">
        <b>材料信号</b>
        <span></span>
        <b>教育学解释</b>
        <span></span>
        <b>学习动作</b>
        <span></span>
        <b>验证门槛</b>
      </div>
      ${matches.map((item, index) => `
        <article style="--i:${index}">
          <em>${String(index + 1).padStart(2, '0')}</em>
          <div class="inference-signal">${escapeHtml(item.signal)}</div>
          <div class="inference-theory">${escapeHtml(item.theory || item.why || '学习科学依据待补充')}</div>
          <div class="inference-method">${escapeHtml(item.method)}</div>
          <div class="inference-gate">${escapeHtml(item.evidenceGate)}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderMethodFitEvidenceBoard(model = {}) {
  const matches = Array.isArray(model.talentMethodMatches) ? model.talentMethodMatches : [];
  return `
    <div class="method-fit-board">
      ${matches.map((item, index) => `
        <article>
          <div class="fit-index">${String(index + 1).padStart(2, '0')}</div>
          <h3>${escapeHtml(item.method)}</h3>
          <div class="fit-row"><b>孩子材料信号</b><span>${escapeHtml(item.signal)}</span></div>
          <div class="fit-row"><b>教育学依据</b><span>${escapeHtml(item.theory || item.why || '学习科学依据待补充')}</span></div>
          <div class="fit-row"><b>为什么不直接用别的方法</b><span>${escapeHtml(item.avoid || '不把方法写成固定标签，必须继续验证')}</span></div>
          <div class="fit-gate"><b>验证门槛</b><span>${escapeHtml(item.evidenceGate)}</span></div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderSubjectMethodRationale(subjects = []) {
  return `
    <div class="subject-rationale-board">
      ${subjects.map((subject) => `
        <article>
          <header>
            <b>${escapeHtml(subject.name)}</b>
            <span>${escapeHtml(subject.status || '待验证')}</span>
          </header>
          <p><strong>从成绩/卡点看到什么</strong>${escapeHtml(subject.bottleneck || '等待错题补证')}</p>
          <p><strong>为什么适合这个方法</strong>${escapeHtml(subject.method || '第一步追问 + 错因命名')}</p>
          <div class="rationale-check">
            <span>今晚：${escapeHtml(subject.tonight || '选择一个真实卡点')}</span>
            <span>7 天后：${escapeHtml(subject.day7 || '用变式验证')}</span>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderReportSpine() {
  const steps = [
    ['01', '材料', '测评 / 成绩 / 错题 / 家长观察'],
    ['02', '证据等级', '能说什么，不能说什么'],
    ['03', '潜能解释', '优势、约束、释放条件'],
    ['04', '方法匹配', '追问 / 外化 / 回忆 / 反馈'],
    ['05', '执行验证', '今晚、明天、第 7 天、30 天']
  ];
  return `<div class="spine-board">${steps.map((step) => `
    <div>
      <span>${escapeHtml(step[0])}</span>
      <b>${escapeHtml(step[1])}</b>
      <p>${escapeHtml(step[2])}</p>
    </div>
  `).join('')}</div>`;
}

function renderChapterDivider(id, eyebrow, title, items = []) {
  return renderReportPage(id, eyebrow, title, `
    <div class="chapter-hero">
      ${items.map((item, index) => `
        <div>
          <span>${String(index + 1).padStart(2, '0')}</span>
          <b>${escapeHtml(item[0])}</b>
          <p>${escapeHtml(item[1])}</p>
        </div>
      `).join('')}
    </div>
  `, { chapter: true, footer: title });
}

function buildEvidenceCredibilityPages(model = {}) {
  const records = Array.isArray(model.records) ? model.records : [];
  const evidenceRows = [
    ['测评资料', '中等', '学习入口、方法候选、优势/约束信号', '固定能力结论、长期上限、学科命运', '与真实错题、口述过程交叉验证'],
    ['阶段成绩', records.length >= 3 ? '较强' : '中等', '近期优先级、波动方向、需要先修复的学科', '单次成绩原因、孩子努力程度、长期趋势', '至少 3 次成绩 + 对应错因卡'],
    ['错题/作业', '较强', '真实卡点、第一步是否会、错因类型', '整卷能力判断、完整答案外传', '孩子说第一步，系统记录错因'],
    ['家长观察', '中等', '注意力、启动困难、执行环境', '替代孩子真实表现', '与产品内行为证据对照'],
    ['产品行为', '较强', '回忆是否通过、提示是否降级、第 7 天是否迁移', '考试结果承诺', '进入长期画像前二次确认']
  ];
  const revisionRows = [
    ['原始材料说法', '孩子适合听觉输入、目标导向、执行信号较强，也存在空间/视觉外化和坚持节奏约束'],
    ['报告修正方式', '不写成“某类孩子”，而写成“先听说启动、再画图外化、再用回忆验证”的学习路径'],
    ['置信度来源', '测评与成绩方向一致时提高；只有测评、没有错题时保持谨慎；第 7 天迁移通过后再写入长期画像'],
    ['家长可用结论', '孩子不是没潜力，而是要把优势放在正确任务上：用语言启动、用结构承接、用短反馈维持']
  ];
  return [
    renderReportPage('evidence-credibility', '02.1 证据可信度说明', '先说明依据，再给学习建议', `
      <p class="lead">参考高质量咨询报告的写法，本报告先交代“证据等级”和“使用边界”。这样家长知道哪些判断已经有支撑，哪些只是下一步要验证的方法候选。</p>
      ${renderDenseTable(['材料来源', '当前强度', '可以支持', '不能支持', '下一步补证'], evidenceRows)}
      <div class="parent-note">越早的报告越要克制：测评资料可以帮助我们选择入口，但不能替代真实学习行为。真正放行的是孩子能不能说出第一步、能不能在次日回忆、能不能在第 7 天小变式里迁移。</div>
    `),
    renderReportPage('judgement-revision-path', '02.2 判断路径修正', '把天赋语言翻译成可验证路径', `
      ${renderKeyValueRows(revisionRows)}
      <div class="analysis-block">
        <h3>一句话判断</h3>
        <p>当前更适合写成“结构执行 + 听说启动 + 外化补偿 + 短周期反馈”的学习方案，而不是直接写成某个固定类型。这样既保留天赋解释，又能让每条建议回到真实学习证据。</p>
      </div>
      <div class="analysis-block">
        <h3>本质判断</h3>
        <p>家长焦虑通常不是因为缺少建议，而是因为不知道建议为什么适合自己的孩子。本报告要把“孩子的潜能信号”与“方法选择”连起来，再让产品内的原小点点拨、微型小课堂、回忆复习继续收证。</p>
      </div>
    `)
  ].join('');
}

function buildAssessmentDeepPages(model = {}) {
  const profile = model.profile || {};
  const dimensions = [
    {
      id: 'assessment-input',
      title: '输入通道：听、看、说、写怎么配比',
      signal: profile.learningChannel,
      interpretation: '如果听觉输入更容易启动，就先让孩子说题意、说条件、说第一步，再落笔。这里不是贴“听觉型”标签，而是降低启动成本。',
      execution: ['原小点先问“你听完这题，第一步想到什么”', '家长不要急着让孩子抄答案，先听 30 秒复述', '复述通过后再进入小黑板或书面过程'],
      product: '/pages/tutor/tutor?from=report_assessment_input'
    },
    {
      id: 'assessment-cognition',
      title: '认知加工：结构、图像、步骤怎么互补',
      signal: profile.brainPreference,
      interpretation: '结构偏好强的孩子适合先建立框架；视觉/空间细节弱时，需要用小黑板把关系画出来，避免只靠脑内想象。',
      execution: ['理科题先画关系图或过程图', '语文阅读先标段落功能', '英语完形/阅读先说逻辑关系，再看选项'],
      product: '/pages/tutor/tutor?from=report_assessment_blackboard'
    },
    {
      id: 'assessment-behavior',
      title: '行为启动：目标驱动与短周期反馈',
      signal: profile.behaviorMode,
      interpretation: '目标驱动不是“逼目标”，而是把目标切成可完成的小动作。报告必须告诉家长今晚做哪一步、明天回看哪一张卡。',
      execution: ['每次只设一个 P0 科目动作', '完成后记录“第一步 + 错因 + 下次回访”', '反馈只奖励过程证据，不奖励刷题数量'],
      product: '/pages/entry-detail/entry-detail?scene=today&from=report_assessment_behavior'
    },
    {
      id: 'assessment-persistence',
      title: '坚持节奏：注意力与复习频率',
      signal: profile.persistenceIndex,
      interpretation: '坚持信号偏弱时，产品要用游戏化降低启动阻力，用间隔复习验证保留，而不是把孩子推向更长时间硬撑。',
      execution: ['10-15 分钟一个闭环', '次日 5 分钟回忆，不会就降级提示', '第 7 天做小变式，确认是否真的迁移'],
      product: '/pages/review/review?from=report_assessment_persistence'
    }
  ];
  return dimensions.map((item, index) => renderReportPage(
    item.id,
    `03.${index + 3} 测评拆解`,
    item.title,
    `
      ${renderKeyValueRows([
        ['当前信号', item.signal || '待补充'],
        ['家长解释', item.interpretation],
        ['产品入口', item.product]
      ])}
      <div class="method-stack">
        ${item.execution.map((line, lineIndex) => `<div><b>${lineIndex + 1}</b><span>${escapeHtml(line)}</span></div>`).join('')}
      </div>
      <div class="parent-note">这类测评信息只能生成“方法候选”，真正能不能成立，要看孩子在真实题目里能否说出第一步、错因和第 7 天变式。</div>
    `,
    { footer: item.title }
  )).join('');
}

function buildTalentEvidencePages(model = {}) {
  const talent = model.talentProfile || {};
  const matches = Array.isArray(model.talentMethodMatches) ? model.talentMethodMatches : [];
  const abilityRows = asArray(talent.abilityRanking).map((item) => [
    item.name || '能力信号',
    item.score || '待补',
    item.level || '待验证',
    item.implication || '需要结合真实任务继续判断'
  ]);
  return [
    renderReportPage('talent-bridge', '02.1 天赋潜能', '先看孩子是什么样的学习者，再看怎么学', `
      <p class="lead">家长最需要的不是一串方法名，而是理解：孩子的优势信号在哪里，为什么目前没有完全释放，下一步如何把潜能转成可观察的学习动作。</p>
      ${renderTalentRadar(model)}
      <div class="thesis-panel">
        <div><b>潜能判断</b><span>${escapeHtml(talent.learnerArchetype || '高可塑学习者')}</span></div>
        <div><b>核心信号</b><span>${escapeHtml(talent.inputPreference || '待补充')}</span></div>
        <div><b>释放条件</b><span>把听懂、会想、想做好，转成能说出第一步、能画出关系、能第 7 天迁移。</span></div>
        <div><b>置信度</b><span>${escapeHtml(talent.confidence || '中等：仍需错题和回访验证')}</span></div>
      </div>
      <div class="parent-note">报告会使用“天赋信号”和“潜能释放条件”，不使用固定标签。这样既能让家长看到孩子的优势，也不会把一次测评写成终身定论。</div>
    `),
    renderReportPage('talent-signal-profile', '02.2 测评信号', '把测评报告翻译成家长能理解的证据', `
      ${renderProfileVisualGrid(model)}
      <div class="visual-caption">解读口径：这些指标只用于选择学习入口和脚手架，不直接推出学科结论；真正的放行证据来自真实错题、孩子口述和第 7 天变式。</div>
    `),
    renderReportPage('talent-ability-ranking', '02.3 天赋能力排序', '优势不是口号，要落到学习动作', `
      ${renderAbilityBarBoard(talent)}
      <div class="visual-caption">从强到弱不是给孩子排序，而是决定方法顺序：强项用于启动和表达，弱项用小黑板、短周期反馈和回忆验证来补偿。</div>
    `),
    renderReportPage('talent-strength-constraint', '02.4 优势与约束', '为什么不是简单地说孩子适合某种学习法', `
      ${renderStrengthWeaknessVisual(talent)}
      <div class="parent-note">如果只写“听觉型、多听”，报告会很浅。更可信的写法是：听觉启动只是入口，必须接上复述、小黑板、错因卡和第 7 天变式，才能形成“确实更会学”的可观察证据。</div>
    `),
    renderReportPage('talent-method-match', '02.5 天赋 × 方法匹配矩阵', '为什么这些方法适合这个孩子', `
      ${renderTalentMethodFlow(model)}
      ${renderMethodFitEvidenceBoard(model)}
      <div class="analysis-block">
        <h3>家长应该怎么看</h3>
        <p>这里不是从产品功能倒推建议，而是从孩子材料里的学习信号出发，先形成方法假设，再规定验证门槛。只有孩子能说出第一步、画出关系、命名错因并在第 7 天迁移，方法才算真正适配。</p>
      </div>
    `),
    renderReportPage('potential-release-plan', '02.6 潜能释放路径', '孩子不是没有潜力，而是需要正确释放条件', `
      <div class="timeline dense-timeline">
        <div><b>第 1 层：启动</b><p>用听说复述和苏格拉底追问，把“我听懂了”变成“我能说出第一步”。</p></div>
        <div><b>第 2 层：外化</b><p>用小黑板和图文双编码，把空间/逻辑负担从脑内搬到纸面。</p></div>
        <div><b>第 3 层：巩固</b><p>用主动回忆和间隔复习，验证知识是否真正保留。</p></div>
        <div><b>第 4 层：迁移</b><p>用第 7 天小变式，确认孩子能把方法迁移到新题。</p></div>
        <div><b>第 5 层：自驱</b><p>把通过验证的方法写入孩子自己的学习流程，家长只看证据，不盯过程。</p></div>
      </div>
      <p class="lead">这就是报告前半部分必须先讲天赋和潜能的原因：家长理解了孩子为什么适合这样学，后面的分科学习方法才不会显得生硬。</p>
    `)
  ].join('');
}

function buildScoreEvidencePages(model = {}) {
  const subjects = Array.isArray(model.subjects) ? model.subjects : [];
  const rows = subjects.map((subject) => [
    subject.name,
    subjectTrendText(subject),
    subject.status || '待验证',
    subject.bottleneck || '待补充真实错题',
    subject.tonight || '今晚选一题说第一步'
  ]);
  const subjectDetailPages = subjects.map((subject, index) => renderReportPage(
    `subject_evidence_${index + 1}`,
    `03.E${index + 1} 学科证据`,
    `${subject.name}：成绩证据怎么读`,
    `
      ${renderKeyValueRows(subjectEvidenceRows(subject))}
      <h3>证据解释</h3>
      <p>这页只回答一个问题：为什么报告建议先这样学。分数、排名和测评不是为了比较孩子，而是帮助家长确定今晚该先修复哪一个学习动作。</p>
      <div class="rubric">
        <div><b>可确认</b><span>${escapeHtml(subjectTrendText(subject))}</span></div>
        <div><b>不可确认</b><span>不能据此判断固定天赋、长期上限或结果确定性。</span></div>
        <div><b>下一证据</b><span>上传 1 张真实错题，孩子口述第一步，系统在第 7 天做变式回访。</span></div>
      </div>
    `,
    { footer: `${subject.name} 成绩证据` }
  )).join('');
  return [
    renderReportPage('score-evidence-matrix', '03.E0 成绩证据矩阵', '把成绩单变成可执行优先级', `
      ${renderSubjectScoreCards(subjects)}
      ${renderSubjectPotentialSplit(subjects)}
      ${renderDenseTable(['学科', '成绩轨迹', '判断', '可能瓶颈', '今晚动作'], rows)}
      <div class="parent-note">矩阵不是为了制造焦虑，而是为了避免家长凭感觉补课、加题或更换方法。</div>
    `),
    renderReportPage('score-method-rationale', '03.E1 成绩 × 天赋 × 方法匹配', '为什么不是每科都用同一种学法', `
      <p class="lead">成绩负责告诉我们先处理哪个学科，测评信号负责告诉我们从哪个入口切入，错题和口述负责验证方法是否真的有效。三类证据合在一起，才给家长一个可信的学习建议。</p>
      ${renderSubjectMethodRationale(subjects)}
      <div class="visual-caption">这页的判断口径：弱项不等于能力差，强项也不等于不用管。每科只保留一个今晚能验证的动作，避免把报告写成大而全的学习口号。</div>
    `),
    subjectDetailPages
  ].join('');
}

function buildProductLoopPages(model = {}) {
  const priority = (model.prioritySubjects || [])[0] || {};
  const loopRows = [
    ['报告页', '家长看到 P0 科目、证据解释、今晚动作', '不展示原题照片和排名营销', '点击进入原小点点拨'],
    ['原小点点拨', '只追问题意、条件、第一步、错因', '不直接给完整答案', '生成错因卡'],
    ['小课堂', '连续说不出概念入口时触发 3 分钟讲解', '不扩展成大课或泛讲', '回到同一题复述'],
    ['小黑板', '把关系图、过程图、公式条件画出来', '不替孩子写完整过程', '形成可回看解释'],
    ['回忆复习', '明天和第 7 天回访同一错因', '不刷题堆量', '通过才进入变式'],
    ['家长复盘', '只看孩子能否说出第一步和下一证据', '不看完整对话', '形成下一周计划']
  ];
  return [
    renderReportPage('product-loop-map', '06.1 产品闭环', '报告不是终点，要自然跳回产品', `
      <p class="lead">家长读完报告后，下一步必须自然发生在产品里。否则报告只是咨询文档，不是 AI 教育产品闭环。</p>
      ${renderDenseTable(['节点', '用户看到什么', '安全边界', '下一跳'], loopRows)}
      <div class="route-card"><b>本次样例默认入口</b><span>${escapeHtml(priority.route || '/pages/tutor/tutor?from=personalized_report')}</span></div>
    `),
    renderReportPage('release-gate', '06.2 报告放行规则', '什么内容可以进入家长报告', `
      <div class="callout-grid">
        <div><b>必须有证据</b><span>成绩记录、测评信号、错题卡、孩子口述或回访结果至少命中一类。</span></div>
        <div><b>必须有动作</b><span>每条建议都要落到今晚、明天、第 7 天，不允许只写抽象评价。</span></div>
        <div><b>必须可降级</b><span>孩子不会时给小课堂、小黑板、提示阶梯，而不是继续加题。</span></div>
        <div><b>必须可追踪</b><span>进入 review/arcade/focus 后要回收证据，更新下一版报告。</span></div>
      </div>
      ${renderKeyValueRows([
        ['AI 生成前', '先由本地规则整理字段、脱敏和证据等级'],
        ['AI 生成中', '只允许改写解释、生成话术和总结，不决定长期标签'],
        ['AI 生成后', '检查禁用词、隐私字段、结果承诺和是否缺少下一步'],
        ['家长看到', '结论、证据、动作、入口和边界，不看到原始敏感材料']
      ])}
    `)
  ].join('');
}

function buildDeliveryQualityPages() {
  return [
    renderReportPage('quality-rubric', '09.1 交付质量', '一份家长愿意读完的报告要满足什么', `
      <div class="rubric">
        <div><b>像报告</b><span>有封面、目录、章节、页脚、证据表、行动表，而不是聊天摘要。</span></div>
        <div><b>够具体</b><span>每科都能看到成绩轨迹、瓶颈假设、方法选择、今晚动作和第 7 天验证。</span></div>
        <div><b>能降焦虑</b><span>不夸大问题，不给固定标签，把焦虑转成一个可观察动作。</span></div>
        <div><b>能转产品</b><span>每个建议都有产品入口和下一证据，形成持续服务，而不是一次性交付。</span></div>
      </div>
      <p class="lead">报告的可看性来自密度和秩序：信息要多，但每一页只回答一个明确问题。</p>
    `),
    renderReportPage('open-source-printing', '09.2 HTML/PDF 技术路线', '为什么优先 HTML 预览 + 可打印 PDF', `
      ${renderKeyValueRows([
        ['当前选择', 'HTML 作为主产物，CSS Paged Media 控制 A4 打印，浏览器/Edge/Chrome 可导出 PDF'],
        ['html-anything 借鉴', '采用它的单文件 HTML、真实 example、skill 化模板、数据报告密集表格和导出自包含思路'],
        ['开源参考', 'Paged.js 适合浏览器端分页预览；WeasyPrint 适合服务端 HTML/CSS 转 PDF'],
        ['暂不引入重依赖', '小程序主链路先保持纯 HTML 模板，避免新增构建和部署复杂度'],
        ['后续升级', '服务端稳定后可把 Paged.js/WeasyPrint 接成批量 PDF 生成器']
      ])}
      <div class="analysis-block">
        <h3>实现原则</h3>
        <p>不为了“看起来像 PDF”牺牲产品闭环。HTML 先保证家长端可预览、可审阅、可追踪；PDF 是交付格式，不是业务主状态。</p>
      </div>
    `)
  ].join('');
}

function buildSubjectDeepPages(model = {}) {
  const subjects = Array.isArray(model.subjects) ? model.subjects : [];
  return subjects.map((subject, index) => {
    const order = String(index + 1).padStart(2, '0');
    const method = subject.method || '第一步追问 + 错因命名 + 间隔回访';
    const trend = subjectTrendText(subject);
    return [
      renderReportPage(
        `subject_${order}_diagnosis`,
        `05.${order} 学科诊断`,
        `${subject.name}：现状、瓶颈与优先级`,
        `
          ${renderKeyValueRows([
            ['最近成绩', `${subject.score == null ? '待补充' : subject.score}${subject.fullScore ? `/${subject.fullScore}` : ''}`],
            ['班级位置', subject.classRank == null ? '待补充' : `班名 ${subject.classRank} · ${rankLabel(subject.classRank)}`],
            ['阶段变化', subject.delta == null ? '等待连续证据' : `${subject.delta >= 0 ? '+' : ''}${subject.delta}`],
            ['优先判断', subject.status || '待判断'],
            ['趋势证据', trend]
          ])}
          <div class="analysis-block">
            <h3>给家长的解释</h3>
            <p>${escapeHtml(subject.bottleneck || '当前还需要用一条真实错题确认卡点。')}</p>
            <p>这部分不把分数解读成孩子能力上限，也不把排名拿来制造焦虑。它只回答一个问题：今晚应该先修哪一个可观察的学习动作。</p>
          </div>
          <div class="evidence-strip">
            <span>证据来源：成绩单/测评/错题</span>
            <span>放行边界：不承诺提分</span>
            <span>下一证据：孩子第一步</span>
          </div>
        `,
        { footer: `${subject.name} 学科诊断` }
      ),
      renderReportPage(
        `subject_${order}_method`,
        `05.${order} 方法匹配`,
        `${subject.name}：为什么推荐这个学习法`,
        `
          <div class="method-explain">
            <h3>推荐组合</h3>
            <p>${escapeHtml(method)}</p>
            <h3>不是直接刷题的原因</h3>
            <p>如果孩子不能说清“第一步看哪里”，继续加题量只会把错误固化。这里先用苏格拉底追问让孩子暴露判断入口，再用费曼复述确认是否真的理解，最后用小变式验证迁移。</p>
            <h3>原小点怎么做</h3>
            <p>AI 不直接给完整答案，只追问题意、条件、第一步、错因和下一道同类题。孩子能说出自己的判断后，才进入小课堂或回忆复习。</p>
          </div>
          <div class="three-column">
            <div><b>孩子做</b><p>${escapeHtml(subject.tonight || '说出第一步。')}</p></div>
            <div><b>家长看</b><p>只看孩子是否能复述题意、条件和第一步，不评价聪不聪明。</p></div>
            <div><b>系统记</b><p>记录错因、回访窗口和第 7 天小变式结果。</p></div>
          </div>
        `,
        { footer: `${subject.name} 方法匹配` }
      ),
      renderReportPage(
        `subject_${order}_execution`,
        `05.${order} 执行闭环`,
        `${subject.name}：今晚、明天、第 7 天怎么走`,
        `
          <div class="timeline">
            <div><b>今晚 10-15 分钟</b><p>${escapeHtml(subject.tonight || '选一题真实卡点，只说第一步。')}</p></div>
            <div><b>明天 5 分钟</b><p>遮住答案，回忆昨天的第一步和错因；能说清再做同类题。</p></div>
            <div><b>第 7 天</b><p>${escapeHtml(subject.day7 || '换一个小条件做变式验证。')}</p></div>
            <div><b>30 天</b><p>只保留通过回访验证的方法；没通过就降级为小黑板、听说复述或小课堂补位。</p></div>
          </div>
          <div class="route-card">
            <b>产品内承接入口</b>
            <span>${escapeHtml(subject.route || '/pages/tutor/tutor?from=personalized_report_subject')}</span>
          </div>
          <p class="parent-note">家长看到的结论应该是“下一步能做什么”，不是“孩子哪里不行”。这是报告降低焦虑的核心。</p>
        `,
        { footer: `${subject.name} 执行闭环` }
      )
    ].join('');
  }).join('');
}

function buildMethodologyDeepPages(model = {}) {
  const methods = Array.isArray(model.methodology) ? model.methodology : [];
  const intro = renderReportPage('methodology-evidence-base', '04.0 理论支撑', '为什么这些方法不是随便拼出来的', `
    <p class="lead">报告采用“学习科学 + 原小点点拨机制 + 家庭执行闭环”的三层依据。理论不是堆名词，而是为每个孩子选择更合适的入口、脚手架和验证方式。</p>
    ${renderDenseTable(
      ['理论/产品启发', '解决的问题', '落到报告里的写法', '产品内承接'],
      [
        ['苏格拉底追问 / Khanmigo', '孩子想直接要答案、过程不可见', '先问题意、条件、第一步和错因', '原小点对话'],
        ['费曼复述 / 自我解释', '听懂但讲不出，理解不稳', '用孩子自己的话复述规则和推理', '复述卡与家长摘要'],
        ['双编码 / 工作记忆减负', '长题干、模型、图表在脑内混乱', '一题一图，小黑板外化关系', '小黑板/小课堂'],
        ['主动回忆 + 间隔练习', '会了就忘，复习只看不想', '明天和第 7 天回访同一错因', 'review 回忆系统'],
        ['交错与变式迁移', '换问法就不会', '通过后换一个条件验证迁移', '小变式题与放行规则'],
        ['Synthesis 式复杂任务', '只会单点知识，不会协作表达', '用规则变化和表达任务锻炼迁移', '游戏化回忆和挑战'],
        ['自我调节学习', '家长催促多，孩子自控少', '目标-执行-反馈-复盘四格表', 'focus 计划与家长复盘']
      ]
    )}
    <div class="parent-note">因此，报告会把“适合听/说/画/回忆/游戏化”写成方法候选，并用证据门槛管理置信度。没有验证通过的内容，只能作为下一步尝试，不能写成长期定论。</div>
  `);
  return intro + methods.map((item, index) => renderReportPage(
    `method_${index + 1}`,
    `04.${index + 1} 方法论`,
    item.label || '学习方法',
    `
      <div class="method-deep">
        <p class="lead">${escapeHtml(item.parentLine || '')}</p>
        ${renderKeyValueRows([
          ['来源/启发', item.source || '教育方法论'],
          ['适用场景', index === 0 ? '孩子卡在第一步、想要直接答案、缺少推理过程时' : '需要把理解变成可回访证据时'],
          ['证据门槛', item.evidenceGate || '孩子能说出第一步和错因'],
          ['产品入口', item.productRoute || '/pages/tutor/tutor?from=personalized_report']
        ])}
        <h3>报告里怎么写</h3>
        <p>写成“方法候选 + 证据门槛 + 今晚动作”，不写成固定人格或天赋标签。AI 可以负责把话说得更清楚，但本地规则负责判断是否有足够证据放行。</p>
        <h3>家长读完应该怎么做</h3>
        <p>今晚只观察一个动作：孩子是否能把题意、条件、第一步说清楚。不能说清时，不批评、不加题量，先降级为更小的提示。</p>
      </div>
    `,
    { footer: item.label || '方法论' }
  )).join('');
}

function buildParentScenarioPages() {
  const scenarios = [
    {
      id: 'parent_anxiety',
      title: '家长焦虑很高时怎么读报告',
      rows: [
        ['先看什么', '先看今晚动作和第 7 天验证，不先看长期画像。'],
        ['怎么判断', '孩子能说出第一步，就是今天的有效进展。'],
        ['不要做什么', '不要把一次成绩波动放大成能力判断，也不要立刻加课或加题量。'],
        ['产品承接', '报告页进入原小点点拨，只追问第一步和错因。']
      ],
      body: '焦虑通常来自“不知道下一步做什么”。报告要把焦虑从抽象担心压缩成一个可观察动作：今晚孩子能不能说出第一步。只要这个动作被看见，家长就有了判断依据；如果看不见，也知道应该降级为小黑板、小课堂或更短的回忆复习。'
    },
    {
      id: 'parent_low_focus',
      title: '孩子注意力不稳时怎么执行',
      rows: [
        ['任务颗粒', '10-15 分钟一段，只做一题或一个错因。'],
        ['奖励规则', '只奖励第一步、错因命名、次日回访，不奖励刷题数量。'],
        ['中断处理', '连续卡住时切小课堂或小黑板，不继续硬撑。'],
        ['产品承接', '进入 arcade/review，但 XP 必须绑定真实回忆证据。']
      ],
      body: '注意力问题不能简单理解为“不努力”。产品里的游戏化应该降低启动阻力，而不是把孩子推向更高压力的排名。报告会把游戏化写成“回忆证据的轻奖励”，并明确分数、排名、原题和完整答案不能成为奖励依据。'
    },
    {
      id: 'parent_method_choice',
      title: '苏格拉底、小课堂、复习游戏怎么选',
      rows: [
        ['默认入口', '先用苏格拉底 1v1，因为它最能暴露孩子真实思路。'],
        ['小课堂触发', '孩子连续说不出概念入口，才用 3 分钟小课堂补一个概念。'],
        ['复习游戏触发', '孩子已会第一步但容易忘，进入主动回忆和间隔复习。'],
        ['回到报告', '每次执行都回写到报告证据链。']
      ],
      body: '这三个入口不是并列堆功能，而是一个自然流转：先问第一步，问不出来就补概念，问得出来但不稳定就回忆复习。报告必须把这个流转写清楚，家长才不会以为产品只是“又多了几个按钮”。'
    },
    {
      id: 'parent_score_drop',
      title: '分数下降时怎么避免误判',
      rows: [
        ['先确认', '看是不是单科波动、题型变化、审题失误或知识点断层。'],
        ['再行动', '只选一个最可修复的错因做 7 天验证。'],
        ['不承诺', '不写结果保证，也不写“孩子不适合”。'],
        ['产品承接', '优先进入 review/tutor 的错因回访。']
      ],
      body: '分数下降时，报告的价值不是安慰家长“没事”，而是把下降拆成可以验证的原因。只要原因能被孩子复述、能在第 7 天小变式中被验证，就能形成真实闭环；如果不能验证，就继续收集证据。'
    },
    {
      id: 'parent_delivery',
      title: '给顾问/合作方交付时怎么脱敏',
      rows: [
        ['可以交付', '今晚动作、家长问题、下一证据、验证状态。'],
        ['不能交付', '原题照片、完整答案、完整对话、分数排名、联系方式、固定标签。'],
        ['AI 分工', 'AI 可以改写摘要，但不能决定放行字段。'],
        ['本地分工', '本地规则负责隐私、证据门槛和报告 release gate。']
      ],
      body: '家长报告天然涉及未成年人学习数据，所以可读性和隐私边界必须一起设计。对外交付时只交付行动和证据，不交付原始材料。这样既能让合作方理解孩子下一步怎么学，也不会把家庭私密数据变成营销材料。'
    }
  ];
  return scenarios.map((item, index) => renderReportPage(
    item.id,
    `08.${index + 1} 家长场景`,
    item.title,
    `
      <p class="lead">${escapeHtml(item.body)}</p>
      ${renderKeyValueRows(item.rows)}
      <div class="analysis-block">
        <h3>报告写作要求</h3>
        <p>每个场景都必须同时包含“家长能理解的一句话”“孩子今晚能做的一步”“系统下一次要回收的证据”。缺少任一项，就只是解释，不是闭环。</p>
        <p>所有建议都要回到原点智学的方法论：苏格拉底先问第一步，费曼复述确认理解，双编码小黑板降低负荷，主动回忆和间隔复习验证保留，游戏化只奖励真实过程证据。</p>
      </div>
    `,
    { footer: item.title }
  )).join('');
}

function buildDeepReportPages(model = {}) {
  const latest = model.latestRecord || {};
  const records = Array.isArray(model.records) ? model.records : [];
  const priorityNames = (model.prioritySubjects || []).map((item) => item.name).join(' / ') || '待补充';
  const stableNames = (model.stableSubjects || []).map((item) => item.name).join(' / ') || '待补充';
  const recordRows = records.map((record) => `
    <tr><td>${escapeHtml(record.examName)}</td><td>${escapeHtml(record.totalScore == null ? '-' : record.totalScore)}</td><td>${escapeHtml(record.classRank == null ? '-' : record.classRank)}</td><td>${escapeHtml(record.comboRank == null ? '-' : record.comboRank)}</td></tr>
  `).join('');
  return [
    renderReportPage('notice', '00 报告说明', '这份报告解决什么问题', `
      <p class="lead">它不是给孩子贴标签，也不是承诺提分。它把成绩单、测评报告和错题证据转成家长能执行的学习闭环。</p>
      ${renderKeyValueRows([
        ['输出格式', 'HTML 预览优先，可通过浏览器/Paged.js/WeasyPrint 转 PDF'],
        ['报告密度', '按 30+ 页长报告组织，适合家长阅读和顾问交付'],
        ['产品闭环', '报告 → 原小点点拨 → 小课堂/小黑板 → 回忆复习 → 家长复盘'],
        ['安全边界', '不输出固定天赋标签、不承诺提分、不外传原题/分数排名']
      ])}
    `),
    renderReportPage('executive', '01 核心结论', '家长先看这四件事', `
      ${renderReportSpine()}
      <div class="executive-brief">
        <div><b>孩子的优势信号</b><span>${escapeHtml(model.talentProfile.learnerArchetype || '高可塑学习者')}</span></div>
        <div><b>潜能释放关键</b><span>先说清第一步，再外化关系图，最后用第 7 天变式验证。</span></div>
        <div><b>为什么现在没完全释放</b><span>不是缺少潜力，而是听说优势、执行优势、空间补偿和复习闭环还没有被稳定串起来。</span></div>
      </div>
      <div class="four-cards">
        <div><b>优先修复</b><span>${escapeHtml(priorityNames)}</span></div>
        <div><b>优势承接</b><span>${escapeHtml(stableNames)}</span></div>
        <div><b>最近总分</b><span>${escapeHtml(latest.totalScore == null ? '待补充' : latest.totalScore)}</span></div>
        <div><b>验证周期</b><span>今晚 + 明天 + 第 7 天</span></div>
      </div>
      <p>家长今晚只要确认：孩子能不能说出第一步。如果不能，产品进入苏格拉底 1v1 私教；如果连续卡住，再触发小课堂；如果能说清但容易忘，进入回忆复习和游戏化轻练习。这样做的逻辑不是硬套方法，而是把孩子已有的优势信号转成可验证的学习动作。</p>
    `),
    renderChapterDivider('chapter-evidence-talent', 'PART 01', '证据与天赋潜能', [
      ['证据可信度', '先说明每类材料能支持什么，不能支持什么。'],
      ['判断修正', '把测评语言翻译成可验证的方法假设。'],
      ['潜能画像', '用雷达图和能力条展示优势与约束。'],
      ['方法匹配', '每个天赋信号必须接一个证据门槛。']
    ]),
    renderReportPage('evidence-map', '02 证据地图', '哪些能判断，哪些还不能判断', `
      ${renderKeyValueRows([
        ['成绩证据', records.length ? `${records.length} 次阶段成绩` : '待补充'],
        ['测评证据', `${model.talentProfile.learnerArchetype || '待补充'}；${model.talentProfile.confidence || model.profile.learningChannel || '待补充'}`],
        ['错题证据', '需要继续上传真实错题或让孩子说出第一步'],
        ['长期画像', '必须等第 7 天变式和家长确认后才更新']
      ])}
      ${renderList(model.guardrails || [])}
    `),
    buildEvidenceCredibilityPages(model),
    buildTalentEvidencePages(model),
    renderChapterDivider('chapter-score-method', 'PART 02', '学科定位与方法系统', [
      ['成绩定位', '分数只用于优先级，不用于能力定性。'],
      ['测评拆解', '把输入、认知、行为和坚持拆成可执行入口。'],
      ['理论支撑', '用学习科学和原小点点拨机制解释方法来源。'],
      ['分科执行', '每科都落到今晚、明天、第 7 天。']
    ]),
    renderReportPage('score-trend', '03 成绩趋势', '成绩只用于确定优先级', `
      <table class="score-table"><thead><tr><th>考试</th><th>总分</th><th>班级排名</th><th>组合排名</th></tr></thead><tbody>${recordRows}</tbody></table>
      <p>分数波动不是坏消息，它告诉我们哪里最适合做小闭环验证。报告不会把一次低分写成能力结论，也不会把一次高分写成长期优势。</p>
    `),
    renderReportPage('assessment-profile', '03 测评画像', '测评只提供方法候选', `
      ${renderKeyValueRows([
        ['输入偏好', model.profile.learningChannel],
        ['信息处理', model.profile.brainPreference],
        ['行为启动', model.profile.behaviorMode],
        ['坚持节奏', model.profile.persistenceIndex]
      ])}
      <div class="two-column">
        <div><h3>可利用优势</h3>${renderList(model.profile.strengths || [])}</div>
        <div><h3>避免误读</h3>${renderList(model.profile.risks || [])}</div>
      </div>
    `),
    buildAssessmentDeepPages(model),
    buildScoreEvidencePages(model),
    buildMethodologyDeepPages(model),
    renderReportPage('subject-chapter', '05 学科方案', '每个学科都要落到动作', `
      <p class="lead">下面每个学科拆成三页：诊断、方法匹配、执行闭环。这样家长能看懂“为什么这么学”，孩子也能知道“今晚先做什么”。</p>
      <p>这部分是从样例 PDF 的“测评解释 + 学习方法论 + 学科计划”结构扩展来的，但把每条建议都接回产品入口。</p>
    `, { chapter: true }),
    buildSubjectDeepPages(model),
    renderChapterDivider('chapter-loop-parent', 'PART 03', '产品闭环与家长执行', [
      ['7 天验证', '从一次建议变成可复核证据。'],
      ['30 天复盘', '只保留通过验证的方法。'],
      ['产品承接', '报告自然跳回私教、小课堂、回忆和复盘。'],
      ['家长话术', '把焦虑压缩成一个可观察动作。']
    ]),
    renderReportPage('seven-day-loop', '06 7 天验证', '从建议到证据', `
      <div class="timeline">
        <div><b>Day 1</b><p>只做一个优先学科的一道真实错题，孩子先说第一步。</p></div>
        <div><b>Day 2</b><p>遮住答案回忆昨天的第一步和错因。</p></div>
        <div><b>Day 3-4</b><p>用小黑板或小课堂补一个概念缺口。</p></div>
        <div><b>Day 5-6</b><p>进入主动回忆和轻量游戏化打卡，只奖励过程证据。</p></div>
        <div><b>Day 7</b><p>换条件做小变式，验证能否迁移。</p></div>
      </div>
    `),
    renderReportPage('thirty-day-plan', '07 30 天计划', '把一次报告变成持续闭环', `
      <div class="month-grid">
        <div><b>第 1 周</b><p>确认优先学科和第一步卡点。</p></div>
        <div><b>第 2 周</b><p>建立错因回访卡和小变式题。</p></div>
        <div><b>第 3 周</b><p>把有效方法迁移到第二个学科。</p></div>
        <div><b>第 4 周</b><p>家长复盘：保留有效动作，删除无效动作。</p></div>
      </div>
    `),
    buildProductLoopPages(model),
    renderReportPage('parent-scripts', '08 家长话术', '降低焦虑的问法', `
      <div class="two-column">
        <div><h3>不要说</h3>${renderList(['你怎么又错了', '你是不是不适合学这个', '这次必须提多少分', '别人都能做到为什么你不行'])}</div>
        <div><h3>可以说</h3>${renderList(['这题第一步先看哪里', '你觉得卡在条件、公式还是题意', '明天我们只回看这一张卡', '第 7 天换一个条件再试一次'])}</div>
      </div>
    `),
    buildParentScenarioPages(),
    buildDeliveryQualityPages(),
    renderReportPage('appendix', '09 附录', 'AI 与本地规则分工', `
      ${renderKeyValueRows([
        ['AI 适合做', '解释、追问、复述改写、家长摘要、小课堂脚本'],
        ['本地规则负责', '证据门槛、隐私字段、奖励放行、分享边界、长期画像更新'],
        ['禁止输出', '完整答案、原题外传、分数排名营销、固定天赋标签、结果保证'],
        ['下一步', '把 HTML 预览接入家长端，并提供打印/导出 PDF 路径']
      ])}
    `)
  ].join('');
}

function renderPersonalizedReportHtml(modelInput = {}) {
  const model = modelInput.subjects ? modelInput : buildPersonalizedReportModel(modelInput);
  const latest = model.latestRecord || {};
  const scoreRows = model.subjects.map((subject) => `
    <tr>
      <td>${escapeHtml(subject.name)}</td>
      <td>${subject.score == null ? '待补' : escapeHtml(subject.score)}${subject.fullScore ? `/${escapeHtml(subject.fullScore)}` : ''}</td>
      <td>${subject.classRank == null ? '待补' : escapeHtml(subject.classRank)}</td>
      <td>${subject.delta == null ? '待积累' : subject.delta >= 0 ? `+${escapeHtml(subject.delta)}` : escapeHtml(subject.delta)}</td>
      <td>${escapeHtml(subject.status)}</td>
    </tr>
  `).join('');
  const subjectCards = model.subjects.map((subject) => `
    <article class="subject-card">
      <div class="subject-head">
        <div>
          <h3>${escapeHtml(subject.name)}</h3>
          <p>${escapeHtml(subject.status)} · 班级表现：${escapeHtml(rankLabel(subject.classRank))}</p>
        </div>
        <strong>${subject.score == null ? '-' : escapeHtml(subject.score)}</strong>
      </div>
      <div class="line"><b>关键瓶颈</b><span>${escapeHtml(subject.bottleneck)}</span></div>
      <div class="line"><b>推荐方法</b><span>${escapeHtml(subject.method)}</span></div>
      <div class="line"><b>今晚动作</b><span>${escapeHtml(subject.tonight)}</span></div>
      <div class="line"><b>第 7 天验证</b><span>${escapeHtml(subject.day7)}</span></div>
      <div class="route">${escapeHtml(subject.route)}</div>
    </article>
  `).join('');
  const methodologyCards = model.methodology.map((item) => `
    <article class="method-card">
      <div class="method-source">${escapeHtml(item.source)}</div>
      <h3>${escapeHtml(item.label)}</h3>
      <p>${escapeHtml(item.parentLine)}</p>
      <small>证据门槛：${escapeHtml(item.evidenceGate)}</small>
    </article>
  `).join('');
  const priorities = model.prioritySubjects.map((subject, index) => `
    <div class="priority-row">
      <span>${index + 1}</span>
      <div><b>${escapeHtml(subject.name)}：${escapeHtml(subject.status)}</b><p>${escapeHtml(subject.tonight)}</p></div>
    </div>
  `).join('');
  const visualToc = renderVisualToc(model);
  const frontVisualPages = [
    renderReportPage('front-core-visual', '01 核心结论', '家长先看：核心结论', `
      ${renderParentDiagnosisCanvas(model)}
    `),
    renderReportPage('front-assessment-visual', '02 测评画像', '测评画像与证据边界', `
      ${renderAssessmentDashboard(model)}
      ${renderTalentRadar(model)}
      <div class="evidence-lens">
        <b>测评怎么用</b>
        <span>听觉/表达信号只决定“先说出来”；空间/视觉信号只决定“先画出来”；坚持节奏只决定“任务切小一点”。它们都不是固定标签，也不直接推出学科结论。</span>
      </div>
    `),
    renderReportPage('front-score-visual', '03 成绩趋势与学科优先级', '当前成绩概况', `
      ${renderScoreEvidenceRiver(model.subjects)}
      ${renderSubjectPotentialSplit(model.subjects)}
    `),
    renderReportPage('front-method-visual', '04 个性化学习方法论', '方法论地图', `
      ${renderMethodInferenceMap(model)}
      <div class="evidence-lens">
        <b>为什么可信</b>
        <span>这里先解释“为什么这个孩子适合这种学习动作”，再谈系统如何承接。没有第一步、错因、回忆或变式证据，就不把任何方法写成长期结论。</span>
      </div>
    `),
    renderReportPage('front-subject-action-visual', '05 分学科行动路径', '每个学科都要落到动作', `
      ${renderSubjectScoreCards(model.prioritySubjects.concat(model.stableSubjects).slice(0, 6))}
      <div style="margin-top:18px">${priorities}</div>
    `)
  ].join('');
  const deepReportPages = buildDeepReportPages(model);
  const closingLoopPage = renderReportPage('closing-loop', '06 7 天验证与 30 天执行闭环', '报告如何变成下一步行动', `
    ${renderActionPathVisual(model)}
    <div class="callout-grid">
      <div><b>报告放行规则</b><span>${escapeHtml((model.guardrails || []).slice(0, 2).join('；'))}</span></div>
      <div><b>家长只看什么</b><span>孩子能否说出第一步、错因和下一次验证，不看完整对话。</span></div>
      <div><b>产品回收什么</b><span>私教记录第一步，小课堂记录概念入口，review 记录回忆和变式。</span></div>
      <div><b>下次报告更新</b><span>只把通过回访验证的方法写入长期画像。</span></div>
    </div>
    <p class="print-hint">格式建议：先在小程序/网页中用 HTML 预览，确认后用浏览器或服务端打印为 PDF。</p>
  `);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(model.title)}</title>
<style>
:root{--ink:#1f2933;--muted:#5f6875;--line:#d4d1c5;--paper:#efeee6;--card:#fbfaf4;--teal:#168576;--navy:#1B365D;--blue:#2e6f95;--copper:#a7652b;--warn:#b45309}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Source Han Serif SC","Noto Serif SC","Songti SC","SimSun",serif;line-height:1.56;overflow-x:hidden;font-size:15px}
.page{max-width:1120px;margin:0 auto;padding:28px 18px}.cover{min-height:560px;background:#1B365D;color:white;padding:66px 56px;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden;border:1px solid #0f263e}
.cover:before{content:"";position:absolute;inset:28px;border:1px solid rgba(245,244,237,.24);pointer-events:none}.cover:after{content:"";position:absolute;right:52px;top:58px;width:320px;height:320px;border:1px solid rgba(214,177,109,.46);box-shadow:inset 0 0 0 22px rgba(214,177,109,.08)}
.cover h1{font-size:48px;line-height:1.12;margin:0 0 18px;font-weight:600;max-width:760px;letter-spacing:.02em}.cover p{font-size:19px;color:#dfe7ed;max-width:760px}.accent{width:92px;height:5px;background:#d6b16d;margin:0 0 34px}
.cover-grid{display:grid;grid-template-columns:1.4fr .8fr;gap:34px;align-items:end;position:relative;z-index:1}.cover-label{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#8de8d7;font-weight:800;margin-bottom:18px}.cover-meta{display:grid;gap:10px;margin-top:28px;color:#d7dee7}.cover-meta span{display:inline-flex;border-left:3px solid #20d1ad;padding-left:10px}.cover-panel{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:22px;backdrop-filter:blur(6px)}.cover-panel b{display:block;color:#fff;font-size:14px;margin-bottom:12px}.cover-panel div{display:grid;grid-template-columns:80px 1fr;gap:8px;border-top:1px solid rgba(255,255,255,.14);padding:10px 0}.cover-panel div:first-of-type{border-top:0}.cover-panel span:first-child{color:#9ae6d9}.cover-panel span:last-child{font-weight:700;color:#fff}.cover-badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.cover-badges span{border:1px solid rgba(255,255,255,.24);border-radius:999px;padding:6px 10px;color:#e9f7f5;font-size:13px}
.section{background:var(--card);border:1px solid var(--line);margin-top:18px;padding:28px;border-radius:4px}.section h2{margin:0 0 16px;font-size:27px;line-height:1.22;font-weight:600}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.kpi{background:#f4f1e7;border:1px solid #d8d1bd;border-radius:4px;padding:16px}.kpi b{display:block;font-size:13px;color:var(--muted);margin-bottom:6px}.kpi span{font-size:21px;font-weight:700;color:#16324c}
.report-page{background-color:#fbfaf4;background-image:linear-gradient(rgba(27,54,93,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(27,54,93,.035) 1px,transparent 1px);background-size:32px 32px;border:1px solid var(--line);margin-top:14px;min-height:780px;padding:30px 40px 46px;border-radius:2px;position:relative;break-after:page;box-shadow:0 0 0 1px rgba(27,54,93,.04);font-size:14px}.report-page:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:#1B365D}.report-page:after{content:"";position:absolute;right:24px;top:24px;width:48px;height:48px;border-top:1px solid #d6b16d;border-right:1px solid #d6b16d}.report-page h2{font-size:24px;line-height:1.18;margin:5px 0 12px;font-weight:600;color:#182536}.report-page h3{font-size:16px;margin:9px 0 5px}.report-page p{margin:5px 0}.chapter-page{background:#f4f1e7}.toc-page{background-color:#fbfaf4}.page-kicker{font-size:11px;font-weight:700;color:#8a5a24;letter-spacing:.14em;text-transform:uppercase}.page-foot{position:absolute;left:40px;right:40px;bottom:18px;border-top:1px solid var(--line);padding-top:7px;color:var(--muted);font-size:10px;letter-spacing:.04em}.lead{font-size:15.5px;color:#273648}.kv-table{border:1px solid var(--line);border-radius:2px;overflow:hidden;margin:10px 0}.kv-row{display:grid;grid-template-columns:128px 1fr;border-top:1px solid var(--line)}.kv-row:first-child{border-top:0}.kv-row b{background:#eee9dc;padding:8px 10px;color:#374151}.kv-row span{padding:8px 10px}.analysis-block,.method-explain{background:#f4f1e7;border:1px solid var(--line);border-radius:2px;padding:11px;margin:10px 0}.analysis-block h3,.method-explain h3{margin:5px 0 3px}.evidence-strip{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.evidence-strip span{background:#eef6f2;color:#0e6f62;border:1px solid #b7d9cf;border-radius:999px;padding:4px 8px;font-size:11px}.three-column,.four-cards,.month-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:10px 0}.four-cards{grid-template-columns:repeat(4,minmax(0,1fr))}.three-column>div,.four-cards>div,.month-grid>div{border:1px solid var(--line);border-radius:2px;padding:9px;background:#fffdf7}.four-cards b{display:block;color:#5f6875;font-size:11px}.four-cards span{display:block;margin-top:4px;font-size:16px;font-weight:700;color:#1B365D}.timeline{display:grid;gap:8px;margin:10px 0}.timeline>div{border-left:4px solid var(--navy);background:#f4f1e7;padding:10px 12px;border-radius:2px}.timeline p{margin:3px 0 0}.route-card{border:1px solid #b7d9cf;background:#eef6f2;border-radius:2px;padding:11px;margin-top:10px;display:grid;gap:4px}.route-card span{word-break:break-all;color:#0e6f62}.parent-note{border-left:4px solid #a7652b;background:#fff8e7;padding:8px 10px;border-radius:2px}.two-column{display:grid;grid-template-columns:1fr 1fr;gap:12px}.toc-list{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;margin-top:16px}.toc-row{display:grid;grid-template-columns:36px 1fr 42px;gap:10px;align-items:start;border-bottom:1px solid var(--line);padding:10px 0}.toc-no{font-size:20px;font-weight:700;color:#1B365D}.toc-row b{font-size:15px}.toc-row p{margin:1px 0 0;color:#5f6875}.toc-row em{font-style:normal;color:#334155;text-align:right;font-weight:700}.toc-reading-guide{margin-top:16px;border:1px solid #b7d9cf;background:#eef6f2;border-radius:2px;padding:11px;display:grid;gap:5px}.evidence-chain{border-left:5px solid #168576}.toc-brief{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.toc-brief div{border-top:2px solid #1B365D;background:#fffdf7;padding:10px;border-left:1px solid var(--line);border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.toc-brief b{display:block;color:#8a5a24;margin-bottom:5px}.toc-brief span{color:#2d3748}
.diagnosis-canvas{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;min-height:360px;margin-top:12px;position:relative}.diagnosis-canvas:before{content:"";position:absolute;left:43%;top:26px;bottom:28px;width:1px;background:#d6b16d}.diagnosis-statement{background:#1B365D;color:white;padding:28px 30px;border-radius:2px;position:relative;overflow:hidden}.diagnosis-statement:after{content:"";position:absolute;right:-60px;bottom:-70px;width:220px;height:220px;border:1px solid rgba(214,177,109,.45);transform:rotate(18deg)}.diagnosis-statement span{color:#8de8d7;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.diagnosis-statement h3{font-size:29px;line-height:1.25;margin:16px 0 18px;color:white}.diagnosis-statement p{font-size:16px;color:#dce6ee;max-width:520px}.diagnosis-axis{display:grid;grid-template-columns:auto 1fr auto 1fr auto;align-items:center;gap:10px;position:absolute;left:30px;right:30px;bottom:24px;color:#24415f}.diagnosis-axis b{font-size:12px;background:#fbfaf4;border:1px solid #d8d1bd;padding:5px 8px}.diagnosis-axis i{height:2px;background:#d6b16d}.diagnosis-proof{display:grid;grid-template-columns:1fr 1fr;gap:10px}.diagnosis-proof div{background:#fff;border:1px solid #d8dce1;border-top:4px solid #19b88a;padding:16px 14px;min-height:130px}.diagnosis-proof strong{display:block;font-size:18px;color:#1B365D;line-height:1.2}.diagnosis-proof span{display:block;color:#5f6875;margin-top:8px;font-size:12.5px}.diagnosis-method-map{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.diagnosis-method-map article{background:#fffdf7;border:1px solid #d4d1c5;border-bottom:5px solid #1B365D;padding:13px;min-height:160px}.diagnosis-method-map em{font-style:normal;color:#d6b16d;font-size:24px;font-weight:800}.diagnosis-method-map b{display:block;margin:8px 0;color:#182536;font-size:13px}.diagnosis-method-map span{display:block;color:#0e6f62;font-weight:700}.diagnosis-method-map small{display:block;color:#697586;margin-top:8px;font-size:11px}.diagnosis-bottom-line{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;border-top:2px solid #1B365D;padding-top:10px}.diagnosis-bottom-line div{display:grid;grid-template-columns:70px 1fr;gap:8px}.diagnosis-bottom-line b{color:#8a5a24}.diagnosis-bottom-line span{color:#283747;font-weight:700}.evidence-lens{display:grid;grid-template-columns:120px 1fr;gap:12px;background:#fff8e7;border-left:6px solid #d6b16d;padding:12px 14px;margin-top:10px}.evidence-lens b{font-size:17px;color:#8a5a24}.evidence-lens span{color:#334155}.score-river{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:20px 0 18px;align-items:end}.score-river article{display:grid;grid-template-rows:132px auto auto auto 1fr;gap:5px;background:linear-gradient(180deg,rgba(255,255,255,.45),#fff);border-bottom:4px solid #1B365D;padding:8px 9px;min-height:286px}.river-bar{height:132px;display:flex;align-items:end;justify-content:center;border-bottom:1px solid #d8dce1}.river-bar i{display:block;width:38px;background:linear-gradient(180deg,#20d1ad,#1B365D);border-radius:999px 999px 0 0}.score-river b{font-size:18px;color:#182536}.score-river strong{font-size:20px;color:#0e6f62}.score-river span{font-size:12px;color:#8a5a24;font-weight:700}.score-river small{font-size:11.5px;color:#687386;line-height:1.35}
.profile-visual-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin:14px 0}.visual-tile{background:#fff;border:1px solid #d7dce2;border-top:4px solid #19b88a;border-radius:5px;padding:12px 13px;min-height:118px;box-shadow:0 8px 15px rgba(31,41,51,.10)}.visual-tile.amber{border-top-color:#f59e0b}.visual-tile.mint{background:#eefaf5;border-color:#8bd8c3}.tile-icon{width:23px;height:23px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#19b88a;color:#fff;font-weight:700;font-size:11px;margin-bottom:5px}.visual-tile.amber .tile-icon{background:#f59e0b}.visual-tile b{display:block;color:#1f2933;font-size:13px}.visual-tile strong{display:block;color:#10a778;font-size:18px;font-weight:500;margin:8px 0 5px;line-height:1.15}.visual-tile p{color:#6b7280;margin:0;font-size:11.5px}.visual-caption{background:rgba(238,246,242,.92);border:1px solid #b7d9cf;border-left:5px solid #168576;padding:9px 12px;margin-top:10px;color:#27433e;font-size:13px}.ability-board{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;margin:16px 0}.ability-row{display:grid;grid-template-columns:32px 1fr 118px 38px 64px;align-items:center;gap:10px;background:#fff;border:1px solid #d8dce1;border-radius:5px;padding:10px 12px;box-shadow:0 8px 14px rgba(31,41,51,.10)}.ability-icon{width:25px;height:25px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#19b88a;color:#fff;font-weight:700;font-size:11px}.ability-row.blue .ability-icon{background:#4f8fe8}.ability-row.amber .ability-icon{background:#f97316}.ability-row b{font-size:14px}.ability-row strong{font-size:17px;color:#10a778;font-weight:500}.ability-row.blue strong{color:#4f8fe8}.ability-row.amber strong{color:#f97316}.ability-row em{font-style:normal;color:#77808b;font-size:12px}.bar{height:24px;background:#e5e8ec;border-radius:999px;overflow:hidden}.bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#19b88a,#62d6b3)}.ability-row.blue .bar i{background:#5b93ef}.ability-row.amber .bar i{background:#fb923c}.strength-weakness-board{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}.sw-panel{background:#fff;border-radius:6px;border:1px solid #d7dce2;box-shadow:0 10px 18px rgba(31,41,51,.11);overflow:hidden;min-height:320px}.sw-panel header{display:flex;align-items:center;gap:12px;padding:15px 20px;color:#fff;font-size:21px}.sw-panel header span{width:26px;height:26px;border-radius:50%;background:#fff}.sw-panel.strength header{background:#19b88a}.sw-panel.constraint header{background:#f97316}.sw-panel ul{margin:26px 30px 0;padding:0;list-style:none}.sw-panel li{margin:12px 0;color:#5f6875;font-size:14px}.sw-panel.strength li:before{content:"";display:inline-block;width:9px;height:9px;background:#374151;margin-right:7px}.sw-panel.constraint li:before{content:"△";color:#6b7280;margin-right:7px}.subject-score-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:12px 0 16px}.score-visual-card{background:#fff;border:1px solid #d8dce1;border-left:6px solid #19b88a;border-radius:6px;padding:14px 16px;box-shadow:0 9px 16px rgba(31,41,51,.10);min-height:124px}.score-visual-card.amber{border-left-color:#f59e0b}.score-visual-card.red{border-left-color:#ef4444}.score-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.score-card-head b{font-size:19px;color:#1f2933}.score-card-head strong{font-size:27px;color:#10a778;font-weight:500}.score-visual-card.amber strong{color:#f59e0b}.score-visual-card.red strong{color:#ef4444}.score-card-head small{font-size:12px;color:#7b8490}.score-visual-card p{color:#5f6875;font-size:12px;margin:4px 0}.score-visual-card em{display:block;color:#8b949f;font-style:italic;margin-top:8px;font-size:12px}.match-dots{display:inline-flex;gap:3px;vertical-align:middle}.match-dots i{width:10px;height:10px;border-radius:50%;border:1px solid #94a3b8}.match-dots i.on{background:#19b88a;border-color:#19b88a}.subject-potential-split{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:10px 0}.potential-panel{background:#fff;border:1px solid #d7dce2;border-radius:6px;padding:18px 22px;box-shadow:0 10px 18px rgba(31,41,51,.10);min-height:190px}.potential-panel h3{font-size:19px;margin:0 0 14px}.potential-panel.strong h3{color:#10a778}.potential-panel.focus h3{color:#f59e0b}.potential-panel p{display:grid;grid-template-columns:105px 1fr;gap:8px;margin:11px 0}.potential-panel b{font-size:14px;color:#1f2933}.potential-panel span{color:#6b7280;font-size:12.5px}
.method-logo-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}.method-logo-board article{background:#fff;border:1px solid #d8dce1;border-radius:6px;padding:15px 17px;min-height:138px;box-shadow:0 9px 16px rgba(31,41,51,.10)}.method-logo-board span{display:block;color:#10a778;font-size:23px;margin-bottom:10px}.method-logo-board b{display:block;font-size:17px;color:#1f2933}.method-logo-board p{color:#9aa2ad;font-size:12px}.method-logo-board em{display:block;margin-top:10px;color:#5f6875;font-style:normal;border-top:1px solid #e5e7eb;padding-top:8px;font-size:12px}.action-path-board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}.action-path-board div{background:#fff;border:1px solid #d8dce1;border-top:4px solid #19b88a;border-radius:6px;padding:14px;box-shadow:0 9px 16px rgba(31,41,51,.10);min-height:148px}.action-path-board span{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#1B365D;color:#fff;font-weight:700;margin-bottom:12px}.action-path-board b{display:block;font-size:17px;color:#1f2933}.action-path-board p{color:#5f6875;font-size:12.5px}.radar-visual{display:grid;grid-template-columns:340px 1fr;gap:18px;align-items:center;margin:12px 0 16px}.radar-visual svg{width:100%;max-width:340px;background:rgba(255,255,255,.78);border:1px solid #d8dce1;border-radius:10px;box-shadow:0 10px 18px rgba(31,41,51,.10);padding:12px}.radar-visual text{font-size:12px;fill:#334155}.radar-side{border-left:5px solid #19b88a;background:#eefaf5;padding:16px 18px}.radar-side b{display:block;font-size:18px;color:#1f2933}.radar-side p{color:#4b5563;font-size:13px}.assessment-dashboard{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin:12px 0}.gauge-card{background:#fff;border:1px solid #d8dce1;border-radius:8px;padding:10px;text-align:center;box-shadow:0 8px 14px rgba(31,41,51,.10)}.gauge-card svg{width:88px;height:88px}.gauge-card text:first-of-type{font-size:22px;font-weight:700;fill:#1f2933}.gauge-card text:last-of-type{font-size:11px;fill:#6b7280}.gauge-card b{display:block;color:#5f6875;margin-top:3px;font-size:12px}.gauge-card strong{display:block;color:#1f2933;font-size:13px;margin-top:2px}.method-flow{display:grid;grid-template-columns:1fr 28px 1fr;gap:8px 10px;margin:14px 0}.flow-node{background:#fff;border:1px solid #d8dce1;border-radius:8px;min-height:58px;padding:10px 12px;box-shadow:0 8px 14px rgba(31,41,51,.09)}.flow-node.signal{border-left:5px solid #19b88a}.flow-node.method{border-left:5px solid #f59e0b}.flow-node span{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#19b88a;color:white;font-size:11px;font-weight:700;margin-right:6px}.flow-node b{font-size:13px;color:#1f2933}.flow-node small{display:block;color:#6b7280;margin-top:5px;font-size:11.5px}.flow-arrow{display:flex;align-items:center;justify-content:center;color:#9a6a2c;font-size:20px;font-weight:700}
.method-inference-map{display:grid;grid-template-columns:92px 1fr;grid-template-rows:repeat(4,auto);gap:0 18px;margin:20px 0}.inference-spine{grid-row:1 / span 4;display:grid;grid-template-rows:auto 1fr auto 1fr auto 1fr auto;align-items:center;min-height:520px;color:#8a5a24}.inference-spine b{writing-mode:vertical-rl;letter-spacing:.08em;justify-self:center;font-size:13px}.inference-spine span{width:2px;height:100%;background:#d6b16d;justify-self:center}.method-inference-map article{grid-column:2;display:grid;grid-template-columns:48px 1.05fr 1.35fr 1fr 1.15fr;align-items:stretch;border-bottom:1px solid #d4d1c5;min-height:118px;background:linear-gradient(90deg,rgba(238,246,242,.72),rgba(255,253,247,.6))}.method-inference-map article:first-of-type{border-top:2px solid #1B365D}.method-inference-map article em{display:flex;align-items:center;justify-content:center;background:#1B365D;color:white;font-style:normal;font-size:18px;font-weight:800}.method-inference-map article div{padding:12px 13px;border-left:1px solid #d4d1c5;font-size:12.5px;line-height:1.36}.inference-signal{color:#1f2933;font-weight:700}.inference-theory{color:#3f4b5b}.inference-method{color:#0e6f62;font-weight:800;font-size:14px!important}.inference-gate{color:#735421;background:#fff8e7}
.method-fit-board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}.method-fit-board article{background:#fff;border:1px solid #d8dce1;border-left:5px solid #19b88a;border-radius:7px;padding:13px 15px;position:relative;box-shadow:0 9px 16px rgba(31,41,51,.10);min-height:226px}.fit-index{position:absolute;right:14px;top:12px;color:#d6b16d;font-weight:800;font-size:20px}.method-fit-board h3{font-size:16px;margin:0 44px 8px 0;color:#1f2933}.fit-row{display:grid;grid-template-columns:96px 1fr;gap:8px;border-top:1px solid #ece7dc;padding:7px 0}.fit-row b,.fit-gate b{font-size:11px;color:#8a5a24}.fit-row span,.fit-gate span{font-size:12px;color:#344256;line-height:1.35}.fit-gate{background:#eef6f2;border:1px solid #b7d9cf;border-radius:4px;padding:7px 9px;margin-top:6px;display:grid;grid-template-columns:70px 1fr;gap:8px}.subject-rationale-board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.subject-rationale-board article{background:#fff;border:1px solid #d8dce1;border-radius:7px;padding:12px 14px;box-shadow:0 8px 14px rgba(31,41,51,.09)}.subject-rationale-board header{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #ece7dc;padding-bottom:7px;margin-bottom:8px}.subject-rationale-board header b{font-size:18px;color:#1f2933}.subject-rationale-board header span{font-size:12px;color:#0e6f62;background:#eef6f2;border:1px solid #b7d9cf;border-radius:999px;padding:3px 8px}.subject-rationale-board p{display:grid;grid-template-columns:112px 1fr;gap:8px;margin:7px 0;color:#334155;font-size:12.5px}.subject-rationale-board strong{font-size:11px;color:#8a5a24}.rationale-check{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.rationale-check span{background:#f4f1e7;border:1px solid #d4d1c5;border-radius:4px;padding:7px;color:#475569;font-size:11.5px}
.spine-board{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:16px 0}.spine-board div{background:#fff;border:1px solid #d8dce1;border-top:4px solid #1B365D;border-radius:6px;padding:12px;min-height:126px;position:relative}.spine-board div:after{content:"";position:absolute;right:-9px;top:50%;width:10px;height:2px;background:#d6b16d}.spine-board div:last-child:after{display:none}.spine-board span{display:block;color:#10a778;font-size:22px;font-weight:700}.spine-board b{display:block;font-size:16px;color:#1f2933;margin-top:8px}.spine-board p{color:#5f6875;font-size:12px}.chapter-hero{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:60px}.chapter-hero div{background:#fff;border:1px solid #d8dce1;border-left:6px solid #19b88a;border-radius:8px;padding:22px 20px;box-shadow:0 12px 20px rgba(31,41,51,.10);min-height:180px}.chapter-hero span{display:block;color:#d6b16d;font-size:30px;font-weight:700;margin-bottom:16px}.chapter-hero b{display:block;font-size:20px;color:#1f2933}.chapter-hero p{color:#5f6875}
.contents{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.contents div{border-bottom:1px solid var(--line);padding:12px 0;color:var(--navy);font-weight:700}
.notice{border-left:5px solid var(--teal);background:#eef6f2;padding:14px 16px;border-radius:3px;color:#115e59}.score-table,.dense-table{width:100%;border-collapse:collapse}.score-table th,.score-table td,.dense-table th,.dense-table td{border:1px solid var(--line);padding:8px 9px;text-align:left;vertical-align:top}.score-table th,.dense-table th{background:#eee9dc;color:#334155}.dense-table{font-size:12px;line-height:1.34;margin:12px 0}.dense-table td{background:#fffdf7}.dense-table tbody tr:nth-child(even) td{background:#f4f1e7}
.priority-row{display:flex;gap:13px;padding:13px 0;border-bottom:1px solid var(--line)}.priority-row span{width:30px;height:30px;border-radius:50%;background:var(--navy);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;flex:0 0 30px}.priority-row p{margin:3px 0 0;color:var(--muted)}
.subject-card,.method-card{border:1px solid var(--line);border-radius:3px;padding:15px;background:#fffdf7}.subject-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.subject-head h3,.method-card h3{margin:0;font-size:21px;font-weight:600}.subject-head p{margin:3px 0;color:var(--muted)}.subject-head strong{font-size:32px;color:var(--navy)}.line{display:grid;grid-template-columns:86px 1fr;gap:9px;margin-top:8px}.line b{color:#475569}.route{margin-top:10px;color:#0e6f62;font-size:12px;background:#eef6f2;padding:7px;border-radius:3px;word-break:break-all}
.method-source{font-size:12px;color:#8a5a24;font-weight:700;margin-bottom:7px}.method-card p{margin:7px 0;color:#334155}.method-card small{color:var(--muted)}.plan-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}.plan{background:#fff8e7;border:1px solid #e5c690;padding:14px;border-radius:3px}.plan b{display:block;color:#8a5a24;margin-bottom:7px}
.method-stack{display:grid;gap:8px;margin:16px 0}.method-stack div{display:grid;grid-template-columns:36px 1fr;gap:10px;align-items:start;border:1px solid var(--line);border-radius:3px;background:#fffdf7;padding:10px}.method-stack b{width:24px;height:24px;border-radius:50%;background:#1B365D;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px}.method-stack span{color:#334155}.rubric{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}.rubric div,.callout-grid div{border:1px solid #d4d1c5;background:#fffdf7;border-radius:3px;padding:12px}.rubric b,.callout-grid b{display:block;color:#1B365D;margin-bottom:5px}.rubric span,.callout-grid span{color:#3f3a32}.callout-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}.thesis-panel,.executive-brief{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}.thesis-panel div,.executive-brief div{border:1px solid var(--line);background:#fffdf7;border-radius:3px;padding:12px}.thesis-panel b,.executive-brief b{display:block;color:#8a5a24;font-size:12px;margin-bottom:5px}.thesis-panel span,.executive-brief span{font-size:15px;color:#182536}
.footer{color:var(--muted);text-align:center;padding:22px}.print-hint{font-size:13px;color:var(--muted)}
@media(max-width:760px){.page{padding:12px}.cover{padding:42px 24px;min-height:420px}.cover h1{font-size:32px}.cover-grid,.grid,.contents,.plan-grid,.three-column,.four-cards,.month-grid,.two-column,.rubric,.callout-grid,.thesis-panel,.executive-brief,.diagnosis-canvas,.diagnosis-proof,.diagnosis-method-map,.diagnosis-bottom-line,.score-river,.profile-visual-grid,.ability-board,.strength-weakness-board,.subject-score-board,.subject-potential-split,.toc-brief,.method-logo-board,.action-path-board,.radar-visual,.assessment-dashboard,.method-flow,.method-fit-board,.subject-rationale-board,.spine-board,.chapter-hero{grid-template-columns:1fr}.section,.report-page{padding:20px;min-height:auto}.score-table,.dense-table{font-size:14px}.line,.kv-row,.toc-row,.method-stack div,.ability-row,.potential-panel p,.fit-row,.fit-gate,.subject-rationale-board p,.rationale-check,.diagnosis-bottom-line div,.evidence-lens,.method-inference-map,.method-inference-map article{grid-template-columns:1fr}.cover:after,.diagnosis-canvas:before{display:none}.diagnosis-axis{position:static;grid-template-columns:1fr;margin-top:10px}.score-river article{grid-template-rows:auto}.river-bar{height:90px}.inference-spine{display:none}.method-inference-map article div{border-left:0;border-top:1px solid #d4d1c5}.page-foot{position:static;margin-top:24px}.toc-row em{text-align:left}.cover-panel div{grid-template-columns:1fr}.flow-arrow,.spine-board div:after{display:none}}
@page{size:A4;margin:14mm}
@media print{body{background:white}.page{max-width:none;padding:0}.section,.cover,.report-page{break-inside:avoid;border-radius:0;border:0;box-shadow:none}.cover{min-height:260mm}.report-page{min-height:260mm;padding:16mm 14mm 20mm}.print-hint{display:none}}
</style>
</head>
<body>
<main class="page">
  <section class="cover">
    <div class="cover-grid">
      <div>
        <div class="cover-label">Personalized Learning Report</div>
        <div class="accent"></div>
        <h1>${escapeHtml(model.title)}</h1>
        <p>${escapeHtml(model.subtitle)}</p>
        <div class="cover-meta">
          <span>学生：${escapeHtml(model.studentName)}</span>
          <span>阶段：${escapeHtml(model.stage)}</span>
          <span>生成日期：${escapeHtml(model.generatedAt)}</span>
        </div>
        <div class="cover-badges"><span>HTML预览</span><span>A4可打印</span><span>可转PDF</span><span>证据放行</span></div>
      </div>
      <aside class="cover-panel">
        <b>家长先看</b>
        <div><span>优先</span><span>${escapeHtml(model.prioritySubjects.map((item) => item.name).join(' / ') || '待补充')}</span></div>
        <div><span>优势</span><span>${escapeHtml(model.stableSubjects.map((item) => item.name).join(' / ') || '待补充')}</span></div>
        <div><span>周期</span><span>今晚 + 明天 + 第7天</span></div>
        <div><span>边界</span><span>不贴标签，不承诺结果</span></div>
      </aside>
    </div>
  </section>
  ${frontVisualPages}
  ${visualToc}
  ${deepReportPages}
  ${closingLoopPage}
  <div class="footer">原点智学 · 家长可读学习报告 · AI 只辅助表达与追问，不替代老师判断</div>
</main>
</body>
</html>`;
}

module.exports = {
  CORE_METHODOLOGIES,
  normalizeScoreRecords,
  buildPersonalizedReportModel,
  renderPersonalizedReportHtml
};
