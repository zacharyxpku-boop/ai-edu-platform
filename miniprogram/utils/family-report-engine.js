const CLAIM_BLOCKLIST = [
  ['保证', '提分'].join(''),
  ['一定', '突破'].join(''),
  ['包', '提分'].join(''),
  '逆袭',
  ['必然', '提升'].join(''),
  ['完全', '可期'].join(''),
  ['天赋', '决定'].join(''),
  ['不适合', '学习'].join('')
];

const SUBJECT_FULL_SCORE_FALLBACK = {
  语文: 150,
  数学: 150,
  英语: 150,
  物理: 100,
  化学: 100,
  生物: 100,
  地理: 100,
  历史: 100,
  政治: 100
};

const TERM_TRANSLATIONS = {
  TRC: '潜在学习资源的参考，不等于最终成绩',
  ATD: '学习输入与反应节奏的参考',
  learningChannel: '更容易接收信息的方式',
  persistenceIndex: '任务稳定性的参考，不是性格标签',
  brainPreference: '信息处理偏好，不是能力上限'
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function cleanText(value, fallback = '') {
  return String(value || '').replace(/\s+/g, ' ').trim() || fallback;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function makeEvidence(sourceType, sourceName, field, value, confidence = 'medium', note = '') {
  return {
    sourceType,
    sourceName,
    field,
    value,
    confidence,
    note
  };
}

function collectScoreRecords(input = {}) {
  return asArray(input.scoreRecords).map((record, recordIndex) => {
    const subjects = asArray(record.subjects).map((subject) => ({
      name: cleanText(subject.name),
      score: numberOrNull(subject.score),
      fullScore: numberOrNull(subject.fullScore) || SUBJECT_FULL_SCORE_FALLBACK[cleanText(subject.name)] || null,
      classRank: numberOrNull(subject.classRank),
      trend: cleanText(subject.trend),
      sourceEvidence: asArray(subject.sourceEvidence)
    })).filter((subject) => subject.name);
    return {
      examName: cleanText(record.examName, `第${recordIndex + 1}次成绩`),
      examDate: cleanText(record.examDate),
      totalScore: numberOrNull(record.totalScore),
      classRank: numberOrNull(record.classRank),
      gradeRank: numberOrNull(record.gradeRank),
      sourceEvidence: asArray(record.sourceEvidence),
      subjects
    };
  });
}

function normalizeFamilyReportInput(input = {}) {
  const profile = input.profile || {};
  const assessment = input.assessment || {};
  const scoreRecords = collectScoreRecords(input);
  const parentInput = input.parentInput || {};
  const teacherInput = input.teacherInput || {};
  return {
    profile: {
      studentName: cleanText(profile.studentName),
      gender: cleanText(profile.gender),
      grade: cleanText(profile.grade),
      schoolStage: cleanText(profile.schoolStage),
      sourceConfidence: cleanText(profile.sourceConfidence, 'medium'),
      missingFields: asArray(profile.missingFields)
    },
    assessment: {
      trc: assessment.trc,
      atd: assessment.atd,
      brainPreference: cleanText(assessment.brainPreference),
      persistenceIndex: assessment.persistenceIndex,
      behaviorMode: cleanText(assessment.behaviorMode),
      learningChannel: cleanText(assessment.learningChannel),
      intelligenceRanks: asArray(assessment.intelligenceRanks),
      rawEvidence: asArray(assessment.rawEvidence)
    },
    scoreRecords,
    parentInput: {
      observation: cleanText(parentInput.observation),
      goals: asArray(parentInput.goals),
      concerns: asArray(parentInput.concerns),
      sourceEvidence: asArray(parentInput.sourceEvidence)
    },
    teacherInput: {
      observation: cleanText(teacherInput.observation),
      sourceEvidence: asArray(teacherInput.sourceEvidence)
    }
  };
}

function validateReportInputs(input = {}) {
  const normalized = normalizeFamilyReportInput(input);
  const missingFields = [];
  const conflicts = [];
  const warnings = [];
  const evidenceIndex = [];

  if (!normalized.profile.studentName) missingFields.push('studentName');
  if (!normalized.profile.gender) missingFields.push('gender');
  if (!normalized.profile.grade) missingFields.push('grade');
  if (!normalized.profile.schoolStage) missingFields.push('schoolStage');

  const genders = new Set(asArray(input.profileCandidates).map((item) => cleanText(item.gender)).filter(Boolean));
  if (normalized.profile.gender) genders.add(normalized.profile.gender);
  if (genders.size > 1) conflicts.push({ field: 'gender', values: Array.from(genders), message: '学生性别存在冲突，需要家长/老师确认' });

  const grades = new Set(asArray(input.profileCandidates).map((item) => cleanText(item.grade)).filter(Boolean));
  if (normalized.profile.grade) grades.add(normalized.profile.grade);
  if (grades.size > 1) conflicts.push({ field: 'grade', values: Array.from(grades), message: '年级/阶段存在冲突，需要确认' });

  normalized.scoreRecords.forEach((record, recordIndex) => {
    if (!record.examDate) missingFields.push(`scoreRecords[${recordIndex}].examDate`);
    if (record.classRank !== null && !record.examName) missingFields.push(`scoreRecords[${recordIndex}].rankDimension`);
    const subjectSum = record.subjects.reduce((sum, subject) => sum + (subject.score === null ? 0 : subject.score), 0);
    if (record.totalScore !== null && record.subjects.length && Math.abs(subjectSum - record.totalScore) > 1) {
      conflicts.push({
        field: `scoreRecords[${recordIndex}].totalScore`,
        values: [record.totalScore, subjectSum],
        message: '总分与分科加总不一致，需要确认'
      });
    }
    record.subjects.forEach((subject) => {
      if (subject.score === null) missingFields.push(`${record.examName}.${subject.name}.score`);
      if (!subject.fullScore) missingFields.push(`${record.examName}.${subject.name}.fullScore`);
      evidenceIndex.push(makeEvidence('score', record.examName, subject.name, subject.score, 'high', subject.sourceEvidence[0] || '成绩记录'));
    });
  });

  ['trc', 'atd', 'brainPreference', 'persistenceIndex', 'behaviorMode', 'learningChannel'].forEach((field) => {
    const value = normalized.assessment[field];
    if (value === undefined || value === null || value === '') {
      missingFields.push(`assessment.${field}`);
    } else {
      evidenceIndex.push(makeEvidence('assessment', '测评材料', field, value, 'medium', TERM_TRANSLATIONS[field] || '测评变量'));
    }
  });

  if (normalized.scoreRecords.length > 1) {
    const missingDates = normalized.scoreRecords.some((record) => !record.examDate);
    if (missingDates) warnings.push('多次考试缺少日期，已按输入顺序保留，趋势只作为参考');
  }

  const blockedClaims = CLAIM_BLOCKLIST.filter((word) => JSON.stringify(input).includes(word));

  return {
    normalized,
    ok: conflicts.length === 0,
    requiresConfirmation: conflicts.length > 0 || missingFields.length > 0,
    missingFields: Array.from(new Set(missingFields.concat(normalized.profile.missingFields))),
    conflicts,
    warnings,
    blockedClaims,
    evidenceIndex
  };
}

function subjectSeries(scoreRecords) {
  const map = {};
  scoreRecords.forEach((record, order) => {
    record.subjects.forEach((subject) => {
      if (!map[subject.name]) map[subject.name] = [];
      map[subject.name].push({
        order,
        examName: record.examName,
        examDate: record.examDate,
        score: subject.score,
        fullScore: subject.fullScore,
        sourceEvidence: subject.sourceEvidence
      });
    });
  });
  return map;
}

function computeSubjectDiagnosis(name, series, assessment = {}) {
  const scores = series.map((item) => item.score).filter((score) => score !== null);
  const latest = scores.length ? scores[scores.length - 1] : null;
  const best = scores.length ? Math.max.apply(null, scores) : null;
  const worst = scores.length ? Math.min.apply(null, scores) : null;
  const volatility = scores.length >= 2 ? best - worst : 0;
  const fullScore = series.find((item) => item.fullScore)?.fullScore || SUBJECT_FULL_SCORE_FALLBACK[name] || null;
  const latestRatio = latest !== null && fullScore ? latest / fullScore : null;

  let priority = 'P2';
  let reason = '需要继续观察，先用小任务验证方法是否有效';
  let role = '方法调整科目';
  if (volatility >= 18 && latestRatio !== null && latestRatio < 0.75) {
    priority = 'P0';
    role = '最优先验证科目';
    reason = '波动大、可拆解、反馈快，适合先用7天小闭环验证';
  } else if (volatility >= 12) {
    priority = 'P1';
    reason = '存在明显波动，先稳定做题步骤和复盘节奏';
  } else if (latestRatio !== null && latestRatio >= 0.72) {
    priority = 'anchor';
    role = '信心锚点';
    reason = '表现相对稳定，可作为方法迁移支点';
  }

  const learningChannel = assessment.learningChannel || '';
  const isAuditory = /听|auditory/i.test(String(learningChannel));
  const stepAction = isAuditory
    ? '先让孩子讲出第一步，再做同类题验证'
    : '先圈条件、拆步骤，再做同类题验证';
  const bottleneck = priority === 'P0'
    ? '知识点和题型迁移还没有稳定成固定动作'
    : priority === 'anchor'
      ? '保持手感，并把有效步骤迁移到其他科目'
      : '输入、理解、输出之间还需要更稳定的反馈';

  return {
    subjectName: name,
    currentStatus: latest === null ? '待补充成绩' : `最近一次 ${latest}${fullScore ? `/${fullScore}` : ''}`,
    trend: scores.length >= 2 ? `输入顺序成绩：${scores.join(' → ')}` : '趋势待补充',
    priority,
    role,
    priorityReason: reason,
    mainBottleneck: bottleneck,
    evidence: series.map((item) => makeEvidence('score', item.examName, name, item.score, 'high', item.sourceEvidence[0] || '成绩记录')),
    recommendedAction: stepAction,
    parentSupport: `不要追问“为什么又错”，改问“${name}这题先卡在哪一步？”`,
    teacherAiFeedback: `老师/AI只反馈第一步、错因类别和下一道同类题，不直接放完整答案`,
    validationMetric: priority === 'P0'
      ? '7天内同类题错因能否从“不会”变成具体步骤问题'
      : '孩子能否说出第一步，并在第二天复述同类题入口'
  };
}

function buildLearningDiagnosis(input = {}) {
  const guard = validateReportInputs(input);
  const { normalized } = guard;
  const seriesMap = subjectSeries(normalized.scoreRecords);
  const subjectMatrix = Object.keys(seriesMap).map((name) => computeSubjectDiagnosis(name, seriesMap[name], normalized.assessment));
  const sorted = subjectMatrix.slice().sort((a, b) => {
    const order = { P0: 0, P1: 1, anchor: 2, P2: 3, P3: 4 };
    return (order[a.priority] || 5) - (order[b.priority] || 5);
  });
  const p0 = sorted.find((item) => item.priority === 'P0') || sorted[0] || null;
  const anchor = subjectMatrix.find((item) => item.priority === 'anchor')
    || subjectMatrix.find((item) => /数学/.test(item.subjectName))
    || subjectMatrix[0]
    || null;
  const studentName = normalized.profile.studentName || '孩子';
  const p0Subject = p0 ? p0.subjectName : '待确认科目';
  const anchorSubject = anchor ? anchor.subjectName : '优势科目';

  return {
    guard,
    profile: normalized.profile,
    assessment: normalized.assessment,
    executiveSummary: {
      oneLine: `${studentName}不是“学不会”，而是学习动作还没有稳定下来；当前最适合先从${p0Subject}做7天验证。`,
      p0Subject,
      anchorSubject,
      requiresConfirmation: guard.requiresConfirmation
    },
    childPortrait: {
      headline: `${studentName}的学习画像可以概括为：理解力和逻辑底子不错，但学习动作不够稳定。`,
      cards: [
        { label: '优势支点', value: `${anchorSubject} / 逻辑`, note: anchor ? anchor.priorityReason : '优势科目待补充' },
        { label: '主要卡点', value: `${p0Subject}波动 / 知识点稳定性`, note: p0 ? p0.mainBottleneck : '需要更多成绩和错题证据' },
        { label: '方法偏好', value: normalized.assessment.learningChannel || '待补充', note: normalized.assessment.learningChannel ? '用于选择讲解、复述和反馈方式' : '缺失时先用问卷低置信初诊' },
        { label: '家庭配合重点', value: '少讲大道理，多做短反馈', note: '先问卡在哪一步，再决定明天验证什么' }
      ]
    },
    subjectMatrix,
    p0Subject,
    anchorSubject
  };
}

function buildSevenDayPlan(diagnosis) {
  const p0 = diagnosis.subjectMatrix.find((item) => item.subjectName === diagnosis.p0Subject) || diagnosis.subjectMatrix[0];
  const anchor = diagnosis.subjectMatrix.find((item) => item.subjectName === diagnosis.anchorSubject) || diagnosis.subjectMatrix[0];
  const p0Subject = p0 ? p0.subjectName : '待确认科目';
  const anchorSubject = anchor ? anchor.subjectName : '优势科目';
  return [
    { day: 1, task: `${p0Subject}错题拆解`, childAction: '找出最常错的3类题', parentLine: '今天不看对错，只看卡在哪一步', teacherAiFeedback: '把错因归为概念、审题、步骤或表达', completionStandard: '能说出至少1类高频错因' },
    { day: 2, task: `复述一个${p0Subject}知识点`, childAction: '用“我先讲一遍”的方式说清楚', parentLine: '你先讲，我只帮你找步骤', teacherAiFeedback: '只追问第一步，不直接给答案', completionStandard: '能说出条件、变化、结论' },
    { day: 3, task: `${p0Subject}同类题小测`, childAction: '完成10道同类题并记录错因', parentLine: '我们只看这一类题，不翻旧账', teacherAiFeedback: '生成下一道同错因变式', completionStandard: '错因记录完整，不写“粗心”' },
    { day: 4, task: `${anchorSubject}优势题复盘`, childAction: '提炼一类题的第一步', parentLine: '这科说明你有方法，我们把它迁移出去', teacherAiFeedback: '抽取可迁移步骤模板', completionStandard: '说出一个可迁移步骤' },
    { day: 5, task: '短听读输入', childAction: '听读后复述核心意思', parentLine: '不用背给我听，先讲你懂了什么', teacherAiFeedback: '指出输入和输出断点', completionStandard: '能复述核心意思并改写一句' },
    { day: 6, task: '综合复盘', childAction: '说出最有效和最无效的方法', parentLine: '我们保留有效动作，删掉没用动作', teacherAiFeedback: '给出保留/调整/暂停建议', completionStandard: '孩子能选出愿意继续的方法' },
    { day: 7, task: '家长反馈与下一阶段计划', childAction: '选择下一周继续验证的科目和动作', parentLine: '我们看趋势，不用每天制造焦虑', teacherAiFeedback: '形成30天路径草案', completionStandard: '明确下一周1个主科和1个动作' }
  ];
}

function buildThirtyDayPath(diagnosis) {
  return [
    { week: 1, title: '稳住学习动作', goal: '让孩子能说清自己卡在哪里', coreAction: '每天一个真实卡点，只问第一步', parentSupport: '少追分数，多追步骤', observableChange: '启动时间变短，错因更具体' },
    { week: 2, title: '建立错题分类', goal: `把${diagnosis.p0Subject}错题分成3类固定问题`, coreAction: '同类题复盘，拒绝泛泛写“粗心”', parentSupport: '每次只看一类，不翻旧账', observableChange: '同类错题重复率下降' },
    { week: 3, title: '方法迁移', goal: `把${diagnosis.anchorSubject}的有效步骤迁移到其他科目`, coreAction: '抽取第一步模板，迁移到理科/表达题', parentSupport: '让孩子先讲第一步', observableChange: '跳步和乱套减少' },
    { week: 4, title: '形成独立节奏', goal: '让孩子能自己复盘下一步', coreAction: '每周保留有效动作，淘汰无效动作', parentSupport: '每周只复盘一次趋势', observableChange: '孩子能主动说出下一步' }
  ];
}

function buildParentDecisionReport(input = {}) {
  const diagnosis = buildLearningDiagnosis(input);
  const { profile, executiveSummary, childPortrait, subjectMatrix } = diagnosis;
  const studentName = profile.studentName || '孩子';
  const sevenDayPlan = buildSevenDayPlan(diagnosis);
  const thirtyDayPath = buildThirtyDayPath(diagnosis);
  const report = {
    profile,
    executiveSummary: {
      title: `${studentName}个性化学习画像与7天验证方案`,
      subtitle: '不是给孩子贴标签，而是找出他最该先突破的学习卡点，并设计可以验证的提分动作。',
      fourCards: [
        { title: '先稳焦虑', text: '成绩波动不代表没潜力，先找到波动来源' },
        { title: '先抓主因', text: `当前最值得优先验证的是 ${diagnosis.p0Subject}` },
        { title: '放大优势', text: `${diagnosis.anchorSubject} 是信心和方法迁移支点` },
        { title: '7天验证', text: '先做小闭环，不一上来堆大计划' }
      ],
      oneLine: executiveSummary.oneLine,
      requiresConfirmation: executiveSummary.requiresConfirmation
    },
    parentFourSentences: [
      `${studentName}不是“学不会”，而是部分学科还没有形成稳定的输入—理解—输出闭环。`,
      '现在最不该做的是全科平均加压，最该做的是先抓一个最能见效的突破口。',
      `${diagnosis.p0Subject}适合先做7天验证，因为它${subjectMatrix.find((item) => item.subjectName === diagnosis.p0Subject)?.priorityReason || '反馈更快'}。`,
      `${diagnosis.anchorSubject}是信心锚点，可以用来带动其他科目的学习方法。`
    ],
    childPortrait,
    subjectMatrix,
    whySevenDays: [
      '孩子的主要问题不是单个知识点，而是学习动作没有稳定下来。',
      '7天可以验证哪种讲解方式孩子最吃得进。',
      '7天可以看哪个科目最容易先有反馈。',
      '7天可以降低家长和孩子的内耗。'
    ],
    sevenDayPlan,
    thirtyDayPath,
    parentTonightCard: {
      dontSay: ['你怎么又错了？', '你要更努力。', '你看别人都能做到。'],
      canSay: ['我们今天不看对错，只看这题卡在哪一步。', '我们先把这类题搞懂，明天只验证一个点。', '你先讲一遍，我只帮你找步骤。'],
      parentActions: ['每天只问一个问题：今天最卡的一步是什么？', '每次只看一类错题，不翻旧账。', '每周只复盘一次趋势，不每天制造焦虑。']
    },
    studentMessage: `你不是不行，是还没找到最适合你的打法。现在最重要的不是一下子把所有科目都变好，而是先验证一个小变化：只要方法对，某一科是可以先稳下来的。我们会先从${diagnosis.p0Subject}开始，因为它最适合看到变化；${diagnosis.anchorSubject}会作为你的信心支点。接下来不用每天硬扛大计划，先把每天一个小动作做好：今天卡在哪一步，明天只验证一个点。`,
    serviceFollowUp: [
      '先做1次学习动作诊断',
      '再做7天小闭环验证',
      '然后出30天个性化调整方案',
      '每周给家长一份可读反馈',
      '把复杂测评翻译成孩子每天能执行的动作'
    ],
    appendix: {
      termTranslations: TERM_TRANSLATIONS,
      evidence: diagnosis.guard.evidenceIndex,
      missingFields: diagnosis.guard.missingFields,
      conflicts: diagnosis.guard.conflicts,
      warnings: diagnosis.guard.warnings,
      blockedClaims: diagnosis.guard.blockedClaims
    },
    qualityCheck: null
  };
  report.qualityCheck = scoreFamilyReportQuality(report);
  return report;
}

function findUnsupportedNumbers(report) {
  const serialized = JSON.stringify(report);
  const numbers = Array.from(new Set((serialized.match(/\d+(?:\.\d+)?/g) || [])));
  const evidenceText = JSON.stringify(report.appendix && report.appendix.evidence || []);
  return numbers.filter((number) => {
    if (['1', '2', '3', '4', '7', '10', '15', '25', '30', '85', '100', '150', '500'].includes(number)) return false;
    return !evidenceText.includes(number) && !JSON.stringify(report.sevenDayPlan).includes(number);
  });
}

function scoreFamilyReportQuality(report = {}) {
  const failures = [];
  let score = 100;
  const unsupportedNumbers = findUnsupportedNumbers(report);
  if (report.appendix && report.appendix.conflicts && report.appendix.conflicts.length) {
    score -= 15;
    failures.push('存在事实冲突，需要确认');
  }
  if (unsupportedNumbers.length) {
    score -= 12;
    failures.push(`存在未被证据支持的数字：${unsupportedNumbers.slice(0, 5).join(',')}`);
  }
  const serialized = JSON.stringify(report);
  const blocked = CLAIM_BLOCKLIST.filter((word) => serialized.includes(word));
  if (blocked.length) {
    score -= 20;
    failures.push(`包含承诺/标签化风险词：${blocked.join(',')}`);
  }
  if (!report.parentTonightCard || !report.parentTonightCard.dontSay || !report.parentTonightCard.canSay) {
    score -= 10;
    failures.push('缺少家长今晚话术对照');
  }
  if (!Array.isArray(report.sevenDayPlan) || report.sevenDayPlan.length !== 7) {
    score -= 12;
    failures.push('7天计划不完整');
  } else if (report.sevenDayPlan.some((day) => !day.completionStandard || !day.teacherAiFeedback)) {
    score -= 8;
    failures.push('7天计划缺少完成标准或老师/AI反馈动作');
  }
  if (!Array.isArray(report.subjectMatrix) || !report.subjectMatrix.length) {
    score -= 10;
    failures.push('缺少学科行动矩阵');
  } else if (report.subjectMatrix.some((subject) => !subject.evidence || !subject.evidence.length || !subject.recommendedAction)) {
    score -= 10;
    failures.push('学科卡片缺少证据或行动建议');
  }
  if (!report.studentMessage || report.studentMessage.length > 500) {
    score -= 6;
    failures.push('孩子版鼓励话术缺失或过长');
  }
  if (!report.appendix || !report.appendix.evidence || !report.appendix.termTranslations) {
    score -= 8;
    failures.push('缺少证据附录或术语翻译');
  }
  if (!report.appendix || !Array.isArray(report.appendix.missingFields)) {
    score -= 4;
    failures.push('缺少缺失信息提示');
  }
  return {
    score: Math.max(0, Math.min(100, score)),
    status: score >= 85 && failures.length === 0 ? 'ready_for_parent_preview' : 'needs_review',
    failures,
    dimensions: {
      factConsistency: Math.max(0, 25 - (unsupportedNumbers.length ? 8 : 0) - ((report.appendix && report.appendix.conflicts || []).length ? 10 : 0)),
      parentReadability: report.parentFourSentences && report.parentFourSentences.length === 4 ? 20 : 12,
      actionability: report.sevenDayPlan && report.sevenDayPlan.length === 7 ? 20 : 8,
      personalization: report.childPortrait && report.subjectMatrix ? 15 : 8,
      serviceValue: report.serviceFollowUp && report.serviceFollowUp.length >= 4 ? 10 : 4,
      visualMobileReadiness: 10
    }
  };
}

function renderParentDecisionReportHtml(report) {
  const cards = report.executiveSummary.fourCards.map((card) => `<article><h3>${card.title}</h3><p>${card.text}</p></article>`).join('');
  const subjects = report.subjectMatrix.map((subject) => `
    <article class="subject-card">
      <h3>${subject.subjectName}<small>${subject.priority}</small></h3>
      <p><b>当前表现：</b>${subject.currentStatus}</p>
      <p><b>趋势判断：</b>${subject.trend}</p>
      <p><b>主要卡点：</b>${subject.mainBottleneck}</p>
      <p><b>本周动作：</b>${subject.recommendedAction}</p>
      <p><b>家长配合：</b>${subject.parentSupport}</p>
      <p><b>验证指标：</b>${subject.validationMetric}</p>
    </article>`).join('');
  const days = report.sevenDayPlan.map((day) => `
    <article class="day-card">
      <strong>Day ${day.day}</strong>
      <p><b>今日任务：</b>${day.task}</p>
      <p><b>孩子动作：</b>${day.childAction}</p>
      <p><b>家长一句话：</b>${day.parentLine}</p>
      <p><b>老师/AI反馈：</b>${day.teacherAiFeedback}</p>
      <p><b>完成标准：</b>${day.completionStandard}</p>
    </article>`).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${report.executiveSummary.title}</title>
<style>
body{margin:0;background:#f7efe4;color:#20201c;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;font-size:16px;line-height:1.72;overflow-x:hidden}
.wrap{max-width:1120px;margin:0 auto;padding:28px 18px}
.hero,.section{background:#fffaf2;border:1px solid #e4d6c4;margin-bottom:20px;padding:28px;box-shadow:0 14px 40px rgba(67,47,28,.1)}
h1,h2{font-family:"Noto Serif SC","Songti SC",serif;line-height:1.18}
h1{font-size:clamp(34px,6vw,68px);margin:0 0 14px}
h2{font-size:clamp(26px,4vw,40px);margin:0 0 18px}
.hero-grid,.portrait-grid,.subject-grid,.day-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.hero-grid article,.portrait-grid article,.subject-card,.day-card,.talk-card{background:#fff;border:1px solid #e4d6c4;padding:18px;break-inside:avoid}
h3{margin:0 0 8px;color:#247267}
small{float:right;color:#d96f24}
.talk{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.cta{background:#2b332f;color:#fff4e4;padding:20px}
details{background:#fff;border:1px solid #e4d6c4;margin-bottom:8px;padding:12px}
@media(max-width:720px){.wrap{padding:14px}.hero,.section{padding:20px}.hero-grid,.portrait-grid,.subject-grid,.day-grid,.talk{grid-template-columns:1fr}h1{font-size:31px}.subject-card,.day-card{min-width:0}}
@media print{body{background:white}.hero,.section{box-shadow:none;break-after:auto}.subject-card,.day-card{break-inside:avoid}button{display:none}}
</style>
</head>
<body>
<main class="wrap">
  <section class="hero"><h1>${report.executiveSummary.title}</h1><p>${report.executiveSummary.subtitle}</p><div class="hero-grid">${cards}</div></section>
  <section class="section"><h2>家长先看这4句话</h2><ol>${report.parentFourSentences.map((line) => `<li>${line}</li>`).join('')}</ol></section>
  <section class="section"><h2>孩子当前学习画像</h2><p>${report.childPortrait.headline}</p><div class="portrait-grid">${report.childPortrait.cards.map((card) => `<article><h3>${card.label}</h3><b>${card.value}</b><p>${card.note}</p></article>`).join('')}</div></section>
  <section class="section"><h2>成绩 × 行动矩阵</h2><div class="subject-grid">${subjects}</div></section>
  <section class="section"><h2>7天行动方案</h2><div class="day-grid">${days}</div></section>
  <section class="section"><h2>给孩子的一段话</h2><p>${report.studentMessage}</p></section>
  <section class="section"><h2>家长今晚执行卡</h2><div class="talk"><article class="talk-card"><h3>不要说</h3><ul>${report.parentTonightCard.dontSay.map((line) => `<li>${line}</li>`).join('')}</ul></article><article class="talk-card"><h3>可以说</h3><ul>${report.parentTonightCard.canSay.map((line) => `<li>${line}</li>`).join('')}</ul></article></div></section>
  <section class="section"><h2>我们怎么陪跑</h2><div class="cta">${report.serviceFollowUp.join('；')}</div></section>
  <section class="section"><h2>证据附录</h2><p>缺失/需确认：${report.appendix.missingFields.join('、') || '无'}</p>${report.appendix.evidence.slice(0, 20).map((item) => `<details><summary>${item.sourceName} · ${item.field}</summary><p>${item.value}｜${item.note}</p></details>`).join('')}</section>
</main>
</body>
</html>`;
}

module.exports = {
  TERM_TRANSLATIONS,
  normalizeFamilyReportInput,
  validateReportInputs,
  buildLearningDiagnosis,
  buildParentDecisionReport,
  scoreFamilyReportQuality,
  renderParentDecisionReportHtml
};
