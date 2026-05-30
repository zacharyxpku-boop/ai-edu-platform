const api = require('../../utils/api');
const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');
const tutorLadder = require('../../utils/tutor-ladder');
const openMaicPlan = require('../../utils/openmaic-inspired-plan');
const realHomeworkCoverage = require('../../utils/real-homework-coverage');

const SOCRATIC_EFFECTIVENESS_BLOCKED_FIELDS = [
  'original_question',
  'full_answer',
  'answer_key',
  'original_answer',
  'photo',
  'full_dialogue',
  'score',
  'ranking',
  'private_comment'
];

const SOCRATIC_EFFECTIVENESS_STATUS = {
  first_step_spoken: true,
  still_blocked: true
};

function tutorReadableList(label, values = []) {
  const list = Array.isArray(values) ? values : [values];
  const text = list.map((item) => String(item || '').trim()).filter(Boolean).join('、');
  return `${label}：${text || '按当前题目证据补齐。'}`;
}

function tutorReadableAiLocalRows(contract = {}) {
  const rows = Array.isArray(contract.runtimeDecisionRows) ? contract.runtimeDecisionRows : [];
  const blocked = Array.isArray(contract.aiMustNotDecide) ? contract.aiMustNotDecide : [];
  return rows.map((item, index) => ({
    id: item.id || `ai_local_${index + 1}`,
    line: `规则先守住：${item.localDecision || '安全和证据放行'}；AI 只改写：${item.aiAllowedRewrite || '一句更适合孩子的追问'}。`
  })).concat(blocked.length ? [{
    id: 'ai_must_not_decide',
    line: tutorReadableList('不能交给 AI 决定', blocked)
  }] : []);
}

function tutorReadableWorkbenchRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((item, index) => ({
    id: item.id || `workbench_${index + 1}`,
    line: `${item.label || '公开资料'}：只借结构和题型；${tutorReadableList('本地守住', item.localizeAsCode)}；${tutorReadableList('AI 辅助', item.aiBetterFor)}；${tutorReadableList('禁止', item.mustNotUse)}。`
  }));
}

function tutorReadableEventRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((item, index) => ({
    id: item.event || `event_${index + 1}`,
    line: `第 ${item.order || index + 1} 步：${item.event || '完成一个课堂动作'}；门槛：先留下孩子第一步和回访证据。`
  }));
}

function tutorEvidenceThreadLine(thread = {}) {
  if (!thread || !thread.topicCardId) return '';
  return `证据线：已绑定小讲堂回访；第 7 天复核：${thread.day7Gate || '用小变式验证'}。`;
}

const QUICK_ACTIONS = [
  { id: 'read_problem', label: '提示 1/5', desc: '先复述题意，找已知条件' },
  { id: 'write_first_step', label: '提示 2/5', desc: '追问第一步想做什么' },
  { id: 'find_direction', label: '提示 3/5', desc: '给方向，不给最终结果' },
  { id: 'similar_example', label: '提示 4/5', desc: '给相似例子，回到原题' },
  { id: 'method_summary', label: '提示 5/5', desc: '总结方法，进入复习卡' },
  { id: 'fast_mode', label: '加快一点', desc: '先看方向，再自己说第一步' },
  { id: 'find_conditions', label: '帮我检查思路', desc: '圈已知、未知和单位' },
  { id: 'explain_misconception', label: '说错因', desc: '说清卡在哪一步' },
  { id: 'transfer', label: '举一反三', desc: '换一个条件，看方法是否迁移' },
  { id: 'review', label: '复盘', desc: '总结下次先检查什么' }
];

const GUIDED_TUTOR_MODES = [
  {
    id: 'homework_coach',
    title: '作业教练',
    desc: '只带必须做，先问第一步，不替写答案。',
    prompt: '带我完成这项必须做，但每次只问一个问题或给一个最小提示。'
  },
  {
    id: 'wrong_cause',
    title: '错因镜头',
    desc: '把“粗心”拆成审题、建模、计算、表达。',
    prompt: '不要解题，先帮我判断我真正错在哪一步。'
  },
  {
    id: 'transfer',
    title: '举一反三',
    desc: '基于同一方法换条件，检查是否真的会了。',
    prompt: '请给我一道同方法的小变式，但先让我说思路，不要给答案。'
  },
  {
    id: 'self_rehearsal',
    title: '一句复述',
    desc: '用自己的话说清：我错因是什么，下次先检查什么。',
    prompt: '请让我用一句话复述本题错因和下次检查点。'
  }
];

const PEDAGOGY_LADDER = [
  { id: 'level_1', title: '提示 1/5', desc: '复述题意，让孩子找条件。' },
  { id: 'level_2', title: '提示 2/5', desc: '追问孩子第一步想做什么。' },
  { id: 'level_3', title: '提示 3/5', desc: '给方向，但不讲最终结果。' },
  { id: 'level_4', title: '提示 4/5', desc: '给相似例子，而不是原题结果。' },
  { id: 'level_5', title: '提示 5/5', desc: '总结方法，进入同类练习或复习卡。' }
];

const TUTOR_GUARDRAILS = [
  '不替孩子写完整答案',
  '只带今晚必须做',
  '留下自己能复述的一句话',
  '发现抄答案风险会收紧提示'
];

function hasFirstStepEvidence(text = '') {
  const value = String(text || '');
  return value.length >= 8
    && /第一步|先|我先|可以先|圈|找|设|列|画|标|比较|单位|条件|未知/.test(value)
    && !/答案|直接|代写|帮我写|不会|不懂|看不懂|没思路|卡住/.test(value);
}

function countRecentStuckTurns(messages = []) {
  return messages.slice(-4).filter((item) => {
    const text = String(item && item.text ? item.text : '');
    return /不会|不懂|看不懂|没思路|卡住|还是不会|直接给答案|给答案|帮我写|代写/.test(text)
      && !hasFirstStepEvidence(text);
  }).length;
}

function pedagogyPanel(selected, misconceptionTags, masterySignal) {
  const misconception = (misconceptionTags || []).map((item) => item.label || item.axis).filter(Boolean).slice(0, 2);
  const status = storage.formatInternalLabel
    ? storage.formatInternalLabel(masterySignal && masterySignal.status ? masterySignal.status : 'needs_student_step', '等孩子先说第一步')
    : '等孩子先说第一步';
  return {
    title: '带学原则',
    status,
    focus: selected && selected.text ? selected.text : '先锁定第一项必须做',
    misconception: misconception.length ? misconception.join(' / ') : '先说清错因，再继续做题',
    ladder: PEDAGOGY_LADDER,
    guardrails: TUTOR_GUARDRAILS,
    teacherView: '只记录：现在卡在哪、错因是什么、下一步做什么。',
    label: status === 'ready_for_parent_review'
      ? '现在已经能把错因用自己的话说清楚。'
      : status === 'blocked_answer_request'
        ? '检测到直接要答案，我会先收紧到边界提示。'
        : '先问、再提示、再找错因、最后复盘。'
  };
}

function pasteRiskSignal(messages = []) {
  const recentUser = (Array.isArray(messages) ? messages : [])
    .filter((item) => item.role === 'user')
    .slice(-3)
    .map((item) => String(item.text || ''));
  const longPaste = recentUser.some((text) => text.length >= 40);
  const answerSeeking = recentUser.some((text) => /答案|直接|代写|帮我写|tell me the answer/i.test(text));
  return {
    title: '别急着要答案',
    level: longPaste && answerSeeking ? 'high' : longPaste ? 'watch' : 'low',
    label: longPaste && answerSeeking
      ? '检测到大段粘贴加直接要答案，作业点拨会只保留边界提示。'
      : longPaste
        ? '检测到大段粘贴，先让孩子交出第一步再继续。'
        : '最近几轮没有明显抄答案捷径。'
  };
}

function coachConsole(selected, misconceptionTags, masterySignal, pasteRisk, activeStep) {
  const currentAction = QUICK_ACTIONS.find((item) => item.id === activeStep) || QUICK_ACTIONS[0];
  const tags = (misconceptionTags || []).map((item) => item.label || item.axis || item.hint).filter(Boolean);
  const mastery = masterySignal || {
    status: 'needs_student_step',
    evidence_needed: '孩子先给出自己的第一步，咕点才会继续帮。'
  };
  return {
    title: '今晚先看',
    label: '先问思路，只给最小提示，把错因讲清，再留下一句自己的话。',
    focus: selected && selected.text ? selected.text : '先锁定第一项必须做',
    wrongCause: tags.length ? tags.slice(0, 2).join(' / ') : '还在等卡点',
    currentAction: currentAction.label,
    actionDesc: currentAction.desc,
    masteryStatus: storage.formatInternalLabel ? storage.formatInternalLabel(mastery.status, '等孩子先说第一步') : mastery.status,
    evidence: storage.formatInternalLabel ? storage.formatInternalLabel(mastery.evidence_needed, mastery.evidence_needed) : mastery.evidence_needed,
    risk: pasteRisk ? pasteRisk.level : 'low',
    cards: [
      { id: 'ask', title: '先说第一步', body: '孩子先说题目要干嘛，准备先怎么动。' },
      { id: 'hint', title: '只推下一步', body: '作业点拨只打开下一步，不会整题代做。' },
      { id: 'cause', title: '说出错因', body: tags[0] || '先确认错在审题、建模、计算还是表达。' },
      { id: 'proof', title: '说回去', body: mastery.evidence_needed }
    ]
  };
}

function buildThinkingReceipt(messages = [], masterySignal, pasteRisk, activeStep, selected, runtimePressureSignal = null) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const userMessages = safeMessages.filter((item) => item.role === 'user');
  const assistantMessages = safeMessages.filter((item) => item.role === 'assistant');
  const latestUserText = userMessages.length ? String(userMessages[userMessages.length - 1].text || '') : '';
  const firstStepBoard = storage.buildFirstStepPromptCard
    ? storage.buildFirstStepPromptCard({
      title: selected && selected.text ? selected.text : latestUserText,
      sourceText: latestUserText,
      thought: latestUserText,
      stuckPointText: latestUserText,
      subject: selected && selected.subject ? selected.subject : ''
    })
    : null;
  const subjectSkillDepth = storage.buildSubjectSkillDepth
    ? storage.buildSubjectSkillDepth({
      sourceText: latestUserText,
      thought: latestUserText,
      subject: selected && selected.subject ? selected.subject : '',
      title: selected && selected.text ? selected.text : ''
    })
    : null;
  const pressureSignal = runtimePressureSignal && runtimePressureSignal.id
    ? Object.assign({}, subjectSkillDepth || {}, runtimePressureSignal)
    : (subjectSkillDepth || {});
  const curriculumSpine = storage.buildCurriculumSpine
    ? storage.buildCurriculumSpine({
      sourceText: latestUserText,
      thought: latestUserText,
      subject: selected && selected.subject ? selected.subject : '',
      title: selected && selected.text ? selected.text : '',
      subjectSkillDepth
    })
    : null;
  const visualSocraticMatrix = storage.buildVisualSocraticMatrix
    ? storage.buildVisualSocraticMatrix({
      sourceText: latestUserText,
      thought: latestUserText,
      subject: selected && selected.subject ? selected.subject : '',
      title: selected && selected.text ? selected.text : '',
      subjectSkillDepth,
      curriculumSpine
    })
    : null;
  const courseUnitMap = storage.buildCourseUnitMap
    ? storage.buildCourseUnitMap({
      sourceText: latestUserText,
      thought: latestUserText,
      subject: selected && selected.subject ? selected.subject : '',
      title: selected && selected.text ? selected.text : '',
      subjectSeedLibrary: null
    })
    : null;
  const activeCourseUnit = courseUnitMap && courseUnitMap.active && Array.isArray(courseUnitMap.active.units)
    ? courseUnitMap.active.units[0]
    : null;
  const courseUnitQuestionBank = storage.buildCourseUnitQuestionBank
    ? storage.buildCourseUnitQuestionBank({ courseUnitMap })
    : null;
  const courseUnitDepthExpansionAtlas = storage.buildCourseUnitDepthExpansionAtlas
    ? storage.buildCourseUnitDepthExpansionAtlas({ courseUnitMap, courseUnitQuestionBank })
    : null;
  const commercialDepthRunway = storage.buildCommercialDepthRunway
    ? storage.buildCommercialDepthRunway({
      courseUnitMap,
      courseUnitQuestionBank,
      courseUnitDepthExpansionAtlas,
      subjectSkillDepth,
      sourceText: latestUserText,
      thought: latestUserText
    })
    : null;
  const questionTypeCoverageAtlas = tutorLadder.buildQuestionTypeCoverageAtlas
    ? tutorLadder.buildQuestionTypeCoverageAtlas(subjectSkillDepth && subjectSkillDepth.taskType ? subjectSkillDepth.taskType : 'unknown')
    : null;
  const socraticQualityEvaluationSuite = tutorLadder.buildSocraticQualityEvaluationSuite
    ? tutorLadder.buildSocraticQualityEvaluationSuite(subjectSkillDepth && subjectSkillDepth.taskType ? subjectSkillDepth.taskType : 'unknown')
    : null;
  const socraticPromptQualityJudge = tutorLadder.buildSocraticPromptQualityJudge
    ? tutorLadder.buildSocraticPromptQualityJudge(
      subjectSkillDepth && subjectSkillDepth.taskType ? subjectSkillDepth.taskType : 'unknown',
      socraticQualityEvaluationSuite,
      pressureSignal
    )
    : null;
  const socraticAiLocalBoundaryContract = tutorLadder.buildSocraticAiLocalBoundaryContract
    ? tutorLadder.buildSocraticAiLocalBoundaryContract(
      subjectSkillDepth && subjectSkillDepth.taskType ? subjectSkillDepth.taskType : 'unknown',
      pressureSignal
    )
    : null;
  const sevenSubjectMasterySprint = storage.buildSevenSubjectMasterySprint
    ? storage.buildSevenSubjectMasterySprint({
      courseUnitMap,
      courseUnitQuestionBank,
      commercialDepthRunway,
      subjectSkillDepth,
      sourceText: latestUserText,
      thought: latestUserText
    })
    : null;
  const openMaicInspiredTaskPlan = openMaicPlan.buildOpenMaicInspiredTaskPlan({
    taskType: pressureSignal && pressureSignal.taskType ? pressureSignal.taskType : (subjectSkillDepth && subjectSkillDepth.taskType ? subjectSkillDepth.taskType : ''),
    subject: selected && selected.subject ? selected.subject : (subjectSkillDepth && subjectSkillDepth.subject) || '',
    sourceText: latestUserText,
    pressureSignal,
    firstStep: pressureSignal && pressureSignal.firstStep,
    wrongCause: pressureSignal && (pressureSignal.wrongCause || pressureSignal.reportSignal),
    parentCheck: pressureSignal && (pressureSignal.parentCheck || pressureSignal.parentQuestion),
    revisit: pressureSignal && (pressureSignal.revisit || pressureSignal.reviewMove)
  });
  const openMaicInspiredTaskPlanAudit = openMaicPlan.evaluateOpenMaicInspiredTaskPlan(openMaicInspiredTaskPlan);
  const recentUserMessages = userMessages.slice(-3);
  const studentFirst = recentUserMessages.some((item) => hasFirstStepEvidence(item.text || ''));
  const recentStuckCount = countRecentStuckTurns(userMessages);
  const realHomeworkCoverageMatrix = storage.buildRealHomeworkCoverageMatrix
    ? storage.buildRealHomeworkCoverageMatrix({
      subject: selected && selected.subject ? selected.subject : (subjectSkillDepth && subjectSkillDepth.subject) || ''
    })
    : null;
  const blockedAnswer = (masterySignal && masterySignal.status === 'blocked_answer_request')
    || (pasteRisk && pasteRisk.level === 'high');
  const miniLesson = openMaicPlan.buildThreeMinuteMiniLesson({
    taskType: pressureSignal && pressureSignal.taskType ? pressureSignal.taskType : (subjectSkillDepth && subjectSkillDepth.taskType ? subjectSkillDepth.taskType : ''),
    subject: selected && selected.subject ? selected.subject : (subjectSkillDepth && subjectSkillDepth.subject) || '',
    sourceText: latestUserText,
    firstStep: pressureSignal && pressureSignal.firstStep,
    wrongCause: pressureSignal && (pressureSignal.wrongCause || pressureSignal.reportSignal),
    parentCheck: pressureSignal && (pressureSignal.parentCheck || pressureSignal.parentQuestion),
    revisit: pressureSignal && (pressureSignal.revisit || pressureSignal.reviewMove),
    userTurnCount: userMessages.length,
    stillBlockedCount: recentStuckCount,
    hintLevel: activeStep === 'micro_choice' ? 4 : 2,
    hasChildFirstStep: studentFirst,
    answerRisk: blockedAnswer,
    forceMiniLesson: !studentFirst && recentStuckCount >= 2 && userMessages.length >= 3
  });
  const miniLessonAudit = openMaicPlan.evaluateThreeMinuteMiniLesson(miniLesson);
  const evidenceThread = openMaicPlan.buildEvidenceThread
    ? openMaicPlan.buildEvidenceThread({
      miniLesson,
      topicCard: miniLesson.topicCard,
      taskType: pressureSignal && pressureSignal.taskType ? pressureSignal.taskType : (subjectSkillDepth && subjectSkillDepth.taskType ? subjectSkillDepth.taskType : ''),
      subject: selected && selected.subject ? selected.subject : (subjectSkillDepth && subjectSkillDepth.subject) || '',
      firstStep: pressureSignal && pressureSignal.firstStep,
      wrongCause: pressureSignal && (pressureSignal.wrongCause || pressureSignal.reportSignal),
      parentCheck: pressureSignal && (pressureSignal.parentCheck || pressureSignal.parentQuestion)
    })
    : null;
  const namedWrongCause = safeMessages.some((item) => /错因|卡在|审题|建模|条件|单位|符号|第一步/.test(String(item.text || '')));
  const proofSentence = masterySignal && masterySignal.status === 'ready_for_parent_review';
  const score = Math.min(100,
    36
    + (studentFirst ? 18 : 0)
    + (namedWrongCause ? 18 : 0)
    + (!blockedAnswer ? 14 : 0)
    + (proofSentence ? 14 : 0)
  );
  const handoffPlan = {
    title: proofSentence ? '点拨后继续走一小步' : blockedAnswer ? '先退回安全点拨' : '点拨还差一句证据',
    summary: proofSentence
      ? '孩子已经能说回去，下一步不要加讲解，转成修卡点、轻回访或给家长看。'
      : blockedAnswer
        ? '先拦住直接答案，把动作收窄到第一步和错因。'
        : '先补一句自己的第一步，再进入修卡点或轻练。',
    evidenceLine: `当前 ${score}/100 · ${studentFirst ? '有第一步' : '缺第一步'} · ${namedWrongCause ? '有错因' : '缺错因'}`,
    actions: [
      {
        id: 'repair',
        label: '修卡点',
        route: '/pages/review/review?from=tutor_handoff&focus=wrong_cause',
        reason: namedWrongCause ? '错因已经出现，适合沉淀成一张可回访卡。' : '先把卡住点写成一句话，避免点拨后断掉。',
        evidence: namedWrongCause ? '错因卡' : '卡点句'
      },
      {
        id: 'recall',
        label: '5分钟轻练',
        route: '/pages/arcade/arcade?from=tutor_handoff&mode=recall',
        reason: proofSentence ? '已经会说方法，马上用一局轻回访问是否转身还记得。' : '还没完全说清，先用低负担练习保留手感。',
        evidence: '轻回访结果'
      },
      {
        id: 'parent',
        label: '给家长看',
        route: '/pages/profile/profile?from=tutor_handoff',
        reason: '家长只看第一步、错因和下次检查点，不看完整对话。',
        evidence: '家长复盘'
      }
    ]
  };
  return {
    title: '思路记录',
    label: '看的不是“做完没”，而是有没有先想、有没有说清卡点、有没有知道下次先查什么。',
    score,
    focus: selected && selected.text ? selected.text : '还没锁定必须做',
    status: proofSentence ? '已可自己复述' : blockedAnswer ? '已拦住答案捷径' : '还在等一句自己的话',
    firstStepBoard,
    real_homework_pressure_signal: pressureSignal,
    pressureSignal,
    subjectSkillDepth,
    curriculumSpine,
    visualSocraticMatrix,
    courseUnitMap,
    activeCourseUnit,
    courseUnitQuestionBank,
    courseUnitDepthExpansionAtlas,
    courseUnitDepthArchetypes: courseUnitDepthExpansionAtlas && Array.isArray(courseUnitDepthExpansionAtlas.activeArchetypes)
      ? courseUnitDepthExpansionAtlas.activeArchetypes.slice(0, 4)
      : [],
    courseUnitQuestionBankCards: courseUnitQuestionBank && Array.isArray(courseUnitQuestionBank.activeCards)
      ? courseUnitQuestionBank.activeCards.slice(0, 3)
      : [],
    courseUnitTransferLadders: courseUnitQuestionBank && Array.isArray(courseUnitQuestionBank.activeTransferLadders)
      ? courseUnitQuestionBank.activeTransferLadders.slice(0, 3)
      : [],
    commercialDepthRunway,
    realHomeworkCoverageMatrix,
    realHomeworkCoverageSubjects: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.subjectRows)
      ? realHomeworkCoverageMatrix.subjectRows.slice(0, 7)
      : [],
    realHomeworkCoverageTypes: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.typeRows)
      ? realHomeworkCoverageMatrix.typeRows.slice(0, 4)
      : [],
    realHomeworkCoverageClusters: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.sampleClusters)
      ? realHomeworkCoverageMatrix.sampleClusters.slice(0, 3)
      : [],
    realHomeworkQuestionTypeClusters: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.questionTypeClusterRunway)
      ? realHomeworkCoverageMatrix.questionTypeClusterRunway.slice(0, 4)
      : [],
    realHomeworkPublicSources: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.publicSourceLedger)
      ? realHomeworkCoverageMatrix.publicSourceLedger.slice(0, 3)
      : [],
    realHomeworkUseWorkbench: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.publicK12UseWorkbench)
      ? realHomeworkCoverageMatrix.publicK12UseWorkbench.slice(0, 4)
      : [],
    realHomeworkImplementationDecisions: realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.implementationDecisionMatrix)
      ? realHomeworkCoverageMatrix.implementationDecisionMatrix.slice(0, 5)
      : [],
    questionTypeCoverageAtlas,
    socraticQualityEvaluationSuite,
    socraticPromptQualityJudge,
    socratic_ai_local_boundary_contract: socraticAiLocalBoundaryContract,
    socraticAiLocalReadableRows: tutorReadableAiLocalRows(socraticAiLocalBoundaryContract),
    socraticAiLocalBoundaryContract,
    socraticPromptEffectivePrompts: socraticPromptQualityJudge && Array.isArray(socraticPromptQualityJudge.effectivePrompts)
      ? socraticPromptQualityJudge.effectivePrompts.slice(0, 4)
      : [],
    socraticPromptMisleadingPrompts: socraticPromptQualityJudge && Array.isArray(socraticPromptQualityJudge.misleadingPrompts)
      ? socraticPromptQualityJudge.misleadingPrompts.slice(0, 4)
      : [],
    socraticPromptStopConditions: socraticPromptQualityJudge && Array.isArray(socraticPromptQualityJudge.stopConditions)
      ? socraticPromptQualityJudge.stopConditions.slice(0, 4)
      : [],
    openMaicInspiredTaskPlan,
    openMaicInspiredTaskPlanAudit,
    miniLesson,
    miniLessonAudit,
    evidenceThread,
    evidenceThreadLine: tutorEvidenceThreadLine(evidenceThread),
    openMaicInspiredScenes: openMaicInspiredTaskPlan.scenes.slice(0, 6),
    openMaicInspiredEventFlow: openMaicInspiredTaskPlan.eventFlow.slice(0, 6),
    openMaicInspiredReadableEventFlow: tutorReadableEventRows(openMaicInspiredTaskPlan.eventFlow.slice(0, 6)),
    realHomeworkUseReadableWorkbench: tutorReadableWorkbenchRows(
      realHomeworkCoverageMatrix && Array.isArray(realHomeworkCoverageMatrix.publicK12UseWorkbench)
        ? realHomeworkCoverageMatrix.publicK12UseWorkbench.slice(0, 4)
        : []
    ),
    openMaicPublicK12Decisions: openMaicInspiredTaskPlan.publicK12ResourceDecisions.slice(0, 4),
    sevenSubjectMasterySprint,
    handoffPlan,
    checks: [
      { id: 'first', label: '先有自己的想法', done: studentFirst, detail: studentFirst ? '已经说出一步或一个问题' : '还需要先交出自己的第一步' },
      { id: 'cause', label: '已经说出错因', done: namedWrongCause, detail: namedWrongCause ? '对话里出现了明确错因' : '还要把错因说具体' },
      { id: 'safe', label: '避免答案捷径', done: !blockedAnswer, detail: blockedAnswer ? '咕点拦住了直接要答案' : '当前没有高风险捷径' },
      { id: 'proof', label: '能自己复述', done: proofSentence, detail: proofSentence ? '已经可以用一句话讲回去' : '还差一句自己的复盘' }
    ],
    shareLine: `思路记录 ${score}/100 · 当前步骤 ${activeStep || 'read_problem'} · 点拨 ${assistantMessages.length} 轮 · 孩子 ${userMessages.length} 轮`
  };
}

function makeReceiptId(prefix = 'receipt') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function buildSocraticEffectivenessEvent(status, receipt = {}, turnState = {}) {
  const safeStatus = SOCRATIC_EFFECTIVENESS_STATUS[status] ? status : 'still_blocked';
  const turnId = receipt.turnId || receipt.turn_id || '';
  const fallbackId = turnId
    ? ''
    : (receipt.fallbackId || receipt.fallback_id || `fallback_${turnState.roundIndex || 'turn'}_${Date.now()}`);
  const createdAt = new Date().toISOString();
  return {
    event: 'socratic_effectiveness_feedback',
    receiptType: 'thinking_receipt',
    status: safeStatus,
    createdAt,
    created_at: createdAt,
    turnId,
    fallbackId,
    blockedFields: SOCRATIC_EFFECTIVENESS_BLOCKED_FIELDS.slice(),
    coachStep: receipt.coach_step || receipt.activeStep || '',
    hintLevel: Number(turnState.hintLevel || receipt.hint_level || 0),
    roundIndex: Number(turnState.roundIndex || 0)
  };
}

function currentRouteOptions() {
  try {
    if (typeof getCurrentPages !== 'function') return {};
    const pages = getCurrentPages();
    const current = pages && pages.length ? pages[pages.length - 1] : null;
    return current && current.options ? current.options : {};
  } catch (error) {
    return {};
  }
}

function findPublicK12Challenge(options = {}) {
  const from = String(options.from || '');
  const challengeId = String(options.challenge_id || options.challengeId || '');
  const taskType = String(options.task_type || options.taskType || '');
  if (from !== 'public_k12_intake' && !challengeId && !taskType) return null;
  const deck = realHomeworkCoverage && realHomeworkCoverage.buildPublicK12IntakeChallengeDeck
    ? realHomeworkCoverage.buildPublicK12IntakeChallengeDeck({ limit: 21 })
    : [];
  if (!Array.isArray(deck) || !deck.length) return null;
  return deck.find((item) => item.id === challengeId)
    || deck.find((item) => item.taskType === taskType)
    || deck[0];
}

function buildPublicK12SelectedHomework(challenge = {}) {
  const taskType = challenge.taskType || 'unknown';
  const firstMove = challenge.observableFirstMove || challenge.firstStepPrompt || '先说出第一步，不要写完整答案。';
  const wrongCause = challenge.localTransform || challenge.gameUse || taskType;
  return {
    id: `public_k12_tutor_${challenge.id || taskType}`,
    text: challenge.prompt || challenge.title || `公开 K12 挑战：${challenge.subject || '当前学科'} · ${taskType}`,
    subject: challenge.subject || '',
    taskType,
    source: 'public_k12_intake',
    evidence: {
      source: 'public_k12_intake',
      public_k12_challenge_id: challenge.id || '',
      source_id: challenge.sourceId || '',
      task_type: taskType,
      first_step_prompt: firstMove,
      wrong_cause: wrongCause,
      parent_check: challenge.shareHook || challenge.fallbackIfNoChildInput || '家长只问第一步和错因，不看完整答案。',
      misconception_tags: [
        { label: wrongCause, axis: taskType, hint: firstMove }
      ],
      blocked_fields: Array.isArray(challenge.blockedFields) ? challenge.blockedFields.slice() : [],
      share_safe_fields: Array.isArray(challenge.shareSafeFields) ? challenge.shareSafeFields.slice() : [],
      answer_boundary: challenge.answerBoundary || 'first_step_only_no_full_answer'
    },
    publicK12IntakeChallenge: {
      id: challenge.id || '',
      sourceId: challenge.sourceId || '',
      taskType,
      observableFirstMove: firstMove,
      fallbackIfNoChildInput: challenge.fallbackIfNoChildInput || '',
      receiverMustUseOwnMaterial: challenge.receiverMustUseOwnMaterial !== false,
      route: challenge.route || '',
      reviewRoute: challenge.reviewRoute || '',
      arcadeRoute: challenge.arcadeRoute || ''
    }
  };
}

function publicK12TutorIntro(challenge = {}, selected = {}) {
  const subject = challenge.subject || selected.subject || '当前学科';
  const taskType = challenge.taskType || selected.taskType || 'unknown';
  const firstMove = challenge.observableFirstMove || selected.evidence && selected.evidence.first_step_prompt || '先说第一步。';
  return `已进入公开 K12 第一挑战：${subject} · ${taskType}。请贴你自己的作业材料或用一句话复述题目，我只追问第一步：${firstMove} 不给完整答案，不外传原题/照片/分数。`;
}

function buildSocraticFeedbackAdjustment(item, turnState = {}) {
  const currentLevel = Math.max(1, Math.min(5, Number((item && item.hintLevel) || turnState.hintLevel || 1)));
  if (item && item.status === 'first_step_spoken') {
    const nextHintLevel = Math.max(1, currentLevel - 1);
    return {
      status: item.status,
      nextHintLevel,
      activeStep: 'method_summary',
      coachStepLabel: `提示 ${nextHintLevel}/5`,
      nextAction: '进入明天回访，只保留同一个第一步。',
      nextQuestion: '你能用自己的话再说一遍第一步吗？',
      shouldUseTwoChoice: false,
      releaseLine: '孩子已说出第一步，可以转成回访卡。',
      reviewEvidence: 'child_first_step_spoken',
      reviewSeedType: 'next_day_first_step_revisit'
    };
  }
  const nextHintLevel = Math.max(4, Math.min(5, currentLevel + 1));
  return {
    status: 'still_blocked',
    nextHintLevel,
    activeStep: 'micro_choice',
    coachStepLabel: `提示 ${nextHintLevel}/5`,
    nextAction: '连续卡住时切入 3 分钟小讲堂，只补一个概念缺口。',
    nextQuestion: '先二选一：你卡在题目问什么，还是卡在第一步怎么写？',
    shouldUseTwoChoice: true,
    releaseLine: '仍缺孩子自己的第一步，不能进入练习或分享。',
    reviewEvidence: 'socratic_still_blocked',
    reviewSeedType: 'two_choice_parent_handoff'
  };
}

function buildMiniLessonFeedbackBridge(item = {}, receipt = {}, adjustment = {}) {
  const miniLesson = receipt.miniLesson || {};
  const miniLessonAudit = receipt.miniLessonAudit || {};
  const trigger = miniLesson.trigger || {};
  const modeRouter = miniLesson.modeRouter || {};
  const renderGate = miniLesson.renderGate || {};
  const canRenderMiniLesson = renderGate.canRender === true || (!modeRouter.nextMode || modeRouter.nextMode === 'three_minute_mini_lesson');
  if (item.status !== 'still_blocked' || !trigger.shouldTrigger || miniLessonAudit.ok !== true) return null;
  if (!canRenderMiniLesson && modeRouter.nextMode === 'parent_handoff') {
    return {
      id: 'socratic_feedback_parent_handoff_bridge',
      type: 'parent_handoff_required',
      title: '家长接手',
      reason: modeRouter.reason || trigger.reason || adjustment.nextAction,
      route: modeRouter.route || '/pages/profile/profile?from=mini_lesson_parent_handoff',
      nextAction: '停止继续加提示，家长只问一句第一步，明天再回访同一个卡点。',
      evidence: {
        triggerEvidence: trigger.triggerEvidence || {},
        releaseGate: modeRouter.releaseGate || 'parent_confirms_one_question_and_next_day_revisit',
        blockedFields: ['original_question', 'full_answer', 'full_dialogue', 'score', 'ranking', 'talent_label']
      }
    };
  }
  if (!canRenderMiniLesson) return null;
  const evidenceThread = receipt.evidenceThread || miniLesson.evidenceThread || {};
  const topicCard = miniLesson.topicCard || {};
  const blackboard = miniLesson.blackboard || {};
  const seed = {
    source: 'socratic_feedback_still_blocked',
    sourceSeedId: `mini_lesson_feedback_${item.turnId || item.fallbackId || Date.now()}`,
    flowTraceId: evidenceThread.flowTraceId || item.turnId || item.fallbackId || '',
    evidenceThread,
    topicCardId: evidenceThread.topicCardId || topicCard.id || '',
    topicLabel: topicCard.label || miniLesson.conceptGap || '当前概念缺口',
    conceptGap: miniLesson.conceptGap || topicCard.conceptGap || '第一步概念缺口',
    firstStep: blackboard.firstStep || blackboard.boardMove || '先说出第一步',
    blackboardLine: blackboard.boardMove || blackboard.firstStep || '',
    blackboardFrames: Array.isArray(blackboard.frames) ? blackboard.frames : [],
    parentCheck: miniLesson.parentCheck || miniLesson.parentLine || '家长只问第一步，不追完整答案。',
    nextDayReview: miniLesson.nextDayReview || (miniLesson.nearTransfer && miniLesson.nearTransfer.prompt) || '明天换一题，只回访第一步。',
    exitGate: miniLesson.exitGate ? miniLesson.exitGate.passEvidence : 'child_can_say_first_step',
    route: '/pages/tutor/tutor?from=socratic_feedback_mini_lesson',
    subject: receipt.subject || evidenceThread.subject || '',
    taskType: receipt.taskType || evidenceThread.taskType || '',
    blockedFields: ['original_question', 'full_answer', 'full_dialogue', 'score', 'ranking', 'talent_label']
  };
  return {
    id: 'socratic_feedback_mini_lesson_bridge',
    title: '已切入 3 分钟小讲堂',
    reason: trigger.reason || adjustment.nextAction,
    route: seed.route,
    nextAction: '看三帧小黑板，写一句退出票，再决定回访或家长协助。',
    reviewSeed: seed,
    evidence: {
      triggerEvidence: trigger.triggerEvidence || {},
      exitGate: seed.exitGate,
      blockedFields: seed.blockedFields
    }
  };
}

function buildUploadReportSelectedHomework(handoff = {}, options = {}) {
  if (!handoff || handoff.status !== 'ready') return null;
  const miniLessonReport = handoff.openMaicDecisionBridge && handoff.openMaicDecisionBridge.miniLessonReport
    ? handoff.openMaicDecisionBridge.miniLessonReport
    : {};
  const sourceSchemaId = handoff.sourceSchemaId || options.sourceSchemaId || 'uploaded_material';
  const reportId = handoff.reportId || options.reportId || '';
  const firstStep = miniLessonReport.blackboardLine
    || (miniLessonReport.topicPractice && miniLessonReport.topicPractice.prompt)
    || handoff.actionLabel
    || '先说出第一步，不要写完整结果。';
  const parentCheck = miniLessonReport.parentLine
    || miniLessonReport.checkQuestion
    || '家长只问第一步和错因，不看完整结果。';
  const wrongCause = miniLessonReport.conceptGap
    || miniLessonReport.topicLabel
    || '上传材料里的第一步还没说清。';
  return {
    id: `upload_report_tutor_${reportId || sourceSchemaId}`,
    text: handoff.line || handoff.title || `刚上传的${sourceSchemaId}，先做苏格拉底第一步。`,
    subject: handoff.subject || '',
    taskType: miniLessonReport.topicLabel || sourceSchemaId,
    source: 'upload_report_handoff',
    flowTraceId: handoff.flowTraceId || `upload_report:${reportId || sourceSchemaId}`,
    reportId,
    sourceSchemaId,
    evidence: {
      source: 'upload_report_handoff',
      report_id: reportId,
      source_schema_id: sourceSchemaId,
      flow_trace_id: handoff.flowTraceId || `upload_report:${reportId || sourceSchemaId}`,
      task_type: miniLessonReport.topicLabel || sourceSchemaId,
      first_step_prompt: firstStep,
      wrong_cause: wrongCause,
      parent_check: parentCheck,
      next_day_review: miniLessonReport.nextDayReview || '',
      mini_lesson_check_question: miniLessonReport.checkQuestion || '',
      mini_lesson_blackboard_line: miniLessonReport.blackboardLine || '',
      mini_lesson_topic_gate: miniLessonReport.topicLocalGate || '',
      blackboard_frames: Array.isArray(miniLessonReport.blackboardFrames) ? miniLessonReport.blackboardFrames : [],
      blocked_fields: Array.isArray(handoff.blockedFields) ? handoff.blockedFields : ['original_question', 'full_answer', 'score', 'ranking'],
      misconception_tags: [
        { label: wrongCause, axis: sourceSchemaId, hint: firstStep }
      ],
      answer_boundary: 'first_step_only_no_full_answer'
    },
    uploadReportHandoff: {
      title: handoff.title || '',
      actionRoute: handoff.actionRoute || '',
      returnRoute: handoff.returnRoute || '',
      miniLessonReport
    }
  };
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((item) => {
    if (typeof item === 'string') return { label: item };
    return {
      axis: item && item.axis ? item.axis : '',
      label: item && (item.label || item.name || item.keyword) ? (item.label || item.name || item.keyword) : '',
      hint: item && (item.hint || item.reason) ? (item.hint || item.reason) : ''
    };
  }).filter((item) => item.label || item.axis || item.hint).slice(0, 4);
}

function answerFromText(text) {
  const patterns = [
    /(?:答案|结果|等于|=|是)[:：]?\s*([A-Za-z0-9+\-*/().分之%√π]+)$/i,
    /我(?:算|写|选|做)的(?:答案|结果)?(?:是|为)?[:：]?\s*([A-Za-z0-9+\-*/().分之%√π]+)/i,
    /(?:选|答案选)\s*([A-D])/i
  ];
  for (let index = 0; index < patterns.length; index += 1) {
    const hit = String(text || '').match(patterns[index]);
    if (hit && hit[1]) return hit[1];
  }
  return '';
}

function fallbackReply(text, selected, step, misconceptionText) {
  const ladderResult = tutorLadder.buildTutorReply(text, {
    selected,
    currentHintLevel: 1
  });
  if (tutorLadder.isAnswerRequest(text) || tutorLadder.isStuckText(text)) {
    return ladderResult;
  }
  const target = selected && selected.text ? selected.text : '第一项必须做';
  const answerSeeking = tutorLadder.isAnswerRequest(text);
  const claimedAnswer = answerFromText(text);

  if (step === 'check_answer') {
    return {
      reply: claimedAnswer
        ? `收到你写的是「${claimedAnswer}」。先不判结果，我们核对思路：这一步用了哪个条件？`
        : '可以，我们核对思路。把“题目 + 你写的第一步”发来，我只看第一步是否站得住。',
      coach_step: 'write_first_step',
      coach_step_label: '提示 2/5',
      next_action: '发题目和你写的第一步。',
      mastery_signal: {
        status: 'needs_student_step',
        confidence: 0.76,
        evidence_needed: '学生需要提供自己的第一步，咕点只核对思路。'
      }
    };
  }

  if (step === 'fast_mode') {
    return {
      reply: `加快一点也可以：先看「${misconceptionText || '审题/条件/单位'}」。你只回第一步，我用一句话帮你看方向。`,
      coach_step: 'find_direction',
      coach_step_label: '提示 3/5',
      next_action: '先回第一步，不需要完整过程。',
      mastery_signal: {
        status: 'fast_check',
        confidence: 0.74,
        evidence_needed: '学生需要给出第一步或卡点。'
      }
    };
  }

  if (answerSeeking) {
    return ladderResult;
  }

  if (step === 'find_conditions') {
    return {
      reply: `先锁定「${target}」。请列两列：已知条件、要解决的问题。先不算答案。`,
      coach_step: 'find_conditions',
      coach_step_label: '找条件',
      next_action: '把已知条件和未知量分开列出来。',
      mastery_signal: {
        status: 'needs_student_step',
        confidence: 0.67,
        evidence_needed: '学生需要先列条件，再继续。'
      }
    };
  }

  if (step === 'write_first_step') {
    return {
      reply: '现在只写第一步：应该先设什么量、列什么关系，或先画哪条辅助信息。不要写最后结果。',
      coach_step: 'write_first_step',
      coach_step_label: '写第一步',
      next_action: '只写第一步式子或第一句判断，不写完整答案。',
      mastery_signal: {
        status: 'needs_student_step',
        confidence: 0.75,
        evidence_needed: '学生需要提交自己的第一步。'
      }
    };
  }

  if (step === 'explain_full') {
    return {
      reply: `我可以讲透方法，但不替你写最终结果。我们分三步：第一，看题目问什么；第二，找关键条件；第三，再连到方法。先把「${target}」里的题目原文发来。`,
      coach_step: 'read_problem',
      coach_step_label: '提示 1/5',
      next_action: '发题目原文，先一起找条件。',
      mastery_signal: {
        status: 'explain_requested',
        confidence: 0.75,
        evidence_needed: '学生需要在每一步后确认是否理解。'
      }
    };
  }

  if (step === 'explain_misconception') {
    return {
      reply: `先说错因。它大概率卡在「${misconceptionText || '审题建模'}」。你用一句话说：刚才哪一步想错了？`,
      coach_step: 'explain_misconception',
      coach_step_label: '说错因',
      next_action: '说清卡住的是审题、建模、计算还是表达。',
      mastery_signal: {
        status: 'needs_student_step',
        confidence: 0.7,
        evidence_needed: '学生需要说出自己的错因。'
      }
    };
  }

  if (step === 'transfer') {
    return {
      reply: `现在做举一反三。我先给相似例子，不给原题最终结果：如果把「${target}」里的一个条件换掉，第一步还应该检查什么？先说方法，不要算到底。`,
      coach_step: 'similar_example',
      coach_step_label: '提示 4/5',
      next_action: '说出同类题的第一步检查点，再尝试一个小变式。',
      mastery_signal: {
        status: 'transfer_check',
        confidence: 0.72,
        evidence_needed: '学生需要说明同类题第一步为什么不变。'
      }
    };
  }

  if (step === 'review') {
    return {
      reply: `复盘一句话：这类题下次先检查「${misconceptionText || '审题建模'}」，再动笔。把你的复盘句发来。`,
      coach_step: 'method_summary',
      coach_step_label: '提示 5/5',
      next_action: '用一句话总结下次先检查哪一步。',
      mastery_signal: {
        status: 'ready_for_parent_review',
        confidence: 0.78,
        evidence_needed: '学生需要说出本题错因和下次检查点。'
      }
    };
  }

  return {
    reply: `先抓「${target}」。它大概率和「${misconceptionText || '审题建模'}」有关。先用一句话说题目真正问什么。`,
    coach_step: 'read_problem',
    coach_step_label: '读题',
    next_action: '先用一句话说清题目真正问什么。',
    mastery_signal: {
      status: 'needs_student_step',
      confidence: 0.66,
      evidence_needed: '学生需要先说出题目在问什么。'
    }
  };
}

function safetyReply(result, input, selected, step, misconceptionText) {
  if (result && result.risk_type === 'self_harm') {
    return {
      reply: '这个内容我不能继续展开。请先告诉家长或老师；如果你现在很难受，优先联系身边可信的大人或当地紧急支持渠道。',
      coach_step: step || 'read_problem',
      coach_step_label: '读题',
      next_action: '优先联系可信的大人。',
      mastery_signal: {
        status: 'safety_redirect',
        confidence: 0.95,
        evidence_needed: '需要成年人接手。'
      }
    };
  }
  return fallbackReply(input, selected, step, misconceptionText);
}

Page({
  data: {
    input: '',
    loading: false,
    selected: null,
    selectedEvidence: null,
    weakPoints: [],
    misconceptionTags: [],
    activeStep: 'read_problem',
    coachStepLabel: '提示 1/5',
    currentHintLevel: 1,
    nextAction: '先用一句话说清题目真正问什么。',
    masterySignal: null,
    tutorTurnState: null,
    quickActions: QUICK_ACTIONS,
    guidedTutorModes: GUIDED_TUTOR_MODES,
    messages: [],
    pedagogy: null,
    pasteRisk: null,
    coachConsole: null,
    thinkingReceipt: null,
    socraticFeedbackStatus: '',
    socraticFeedbackRecordedAt: '',
    socraticFeedbackNextAction: '',
    miniLessonFeedbackBridge: null,
    miniLessonExitGateStatus: '',
    miniLessonExitGateNextRoute: '',
    miniLessonExitGateAction: null,
    miniLessonParentAssistCard: null,
    miniLessonActiveFrameIndex: 0,
    childExitTicketText: '',
    surfaceDepthPack: null,
    unifiedNextAction: null,
    showTutorDetails: false
  },

  trackedMasteryStatus: '',

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    const pendingRoute = navigation.consumePendingTabRouteContext
      ? navigation.consumePendingTabRouteContext('/pages/tutor/tutor')
      : null;
    this.setData({
      showLegacyEntryContent: !!(pendingRoute && navigation.shouldOpenFunctionalTab(pendingRoute.options))
    });
    const state = storage.loadState();
    const routeOptions = currentRouteOptions();
    const publicK12Challenge = findPublicK12Challenge(routeOptions);
    const publicK12Selected = publicK12Challenge ? buildPublicK12SelectedHomework(publicK12Challenge) : null;
    const uploadReportHandoff = routeOptions.from === 'upload_report_ready' && storage.get
      ? storage.get('upload.report.handoff.v1', null)
      : null;
    const uploadReportSelected = !publicK12Selected && uploadReportHandoff
      ? buildUploadReportSelectedHomework(uploadReportHandoff, routeOptions)
      : null;
    let selected = publicK12Selected || uploadReportSelected || storage.get(storage.KEYS.selectedHomework, null);
    if (publicK12Selected) {
      const sourceKey = `public_k12_intake:${publicK12Challenge.id || publicK12Selected.taskType}`;
      const previousSource = storage.get(storage.KEYS.selectedHomeworkSource, '');
      storage.set(storage.KEYS.selectedHomework, publicK12Selected);
      storage.set(storage.KEYS.selectedHomeworkSource, sourceKey);
      if (previousSource !== sourceKey) {
        storage.set(storage.KEYS.tutorMessages, [
          { role: 'assistant', text: publicK12TutorIntro(publicK12Challenge, publicK12Selected) }
        ]);
      }
    }
    if (uploadReportSelected) {
      const sourceKey = `upload_report:${uploadReportSelected.flowTraceId || uploadReportSelected.reportId || uploadReportSelected.sourceSchemaId}`;
      const previousSource = storage.get(storage.KEYS.selectedHomeworkSource, '');
      storage.set(storage.KEYS.selectedHomework, uploadReportSelected);
      storage.set(storage.KEYS.selectedHomeworkSource, sourceKey);
      if (previousSource !== sourceKey) {
        storage.set(storage.KEYS.tutorMessages, [
          { role: 'assistant', text: `我已接住刚上传的材料。先不讲完整过程，只问一句：${uploadReportSelected.evidence.parent_check}` }
        ]);
      }
    }
    if (!selected) {
      selected = ((state.homework_plan || {}).must_do || [])[0] || null;
      if (selected) {
        storage.set(storage.KEYS.selectedHomework, selected);
        storage.set(storage.KEYS.selectedHomeworkSource, 'auto_first_must');
      }
    }

    const selectedEvidence = selected && selected.evidence ? selected.evidence : null;
    const misconceptionTags = normalizeTags((selectedEvidence && selectedEvidence.misconception_tags) || []);
    const weakPoints = state.weak_points || [];
    const intro = publicK12Challenge
      ? publicK12TutorIntro(publicK12Challenge, selected)
      : selected
      ? `我已锁定今晚第一项必须做：「${selected.text}」。先说你的第一步，我只处理关键错因。`
      : '我只处理必须做任务和关键错因，不替你写作业。先从首页锁定一项今晚必须做。';
    const messages = storage.get(storage.KEYS.tutorMessages, null) || [
      { role: 'assistant', text: intro }
    ];

    const pasteRisk = pasteRiskSignal(messages);
    const tutorTurnState = tutorLadder.nextTutorTurnState
      ? tutorLadder.nextTutorTurnState('', messages, this.data.currentHintLevel, selected)
      : null;
    const receipt = Object.assign({}, buildThinkingReceipt(messages, null, pasteRisk, this.data.activeStep, selected), {
      fallbackId: `initial_${messages.length}`
    });
    this.setData({
      selected,
      selectedEvidence,
      weakPoints,
      misconceptionTags,
      messages,
      pedagogy: pedagogyPanel(selected, misconceptionTags, null),
      pasteRisk,
      coachConsole: coachConsole(selected, misconceptionTags, null, pasteRisk, this.data.activeStep),
      thinkingReceipt: receipt,
      socraticFeedbackStatus: '',
      socraticFeedbackRecordedAt: '',
      socraticFeedbackNextAction: '',
      miniLessonFeedbackBridge: null,
      miniLessonExitGateStatus: '',
      miniLessonExitGateNextRoute: '',
      miniLessonExitGateAction: null,
      miniLessonParentAssistCard: null,
      miniLessonActiveFrameIndex: 0,
      childExitTicketText: '',
      tutorTurnState,
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('tutor') : null,
      unifiedNextAction: storage.buildUnifiedNextActionController ? storage.buildUnifiedNextActionController({ surface: 'tutor' }) : null
    });
    this.trackedMasteryStatus = '';
  },

  toggleTutorDetails() {
    this.setData({ showTutorDetails: !this.data.showTutorDetails });
  },

  onInput(event) {
    this.setData({ input: event.detail.value });
  },

  onMiniLessonExitTicketInput(event) {
    this.setData({ childExitTicketText: event.detail.value });
  },

  setMiniLessonActiveFrame(event) {
    const receipt = this.data.thinkingReceipt || {};
    const frames = receipt.miniLesson && receipt.miniLesson.blackboard && Array.isArray(receipt.miniLesson.blackboard.frames)
      ? receipt.miniLesson.blackboard.frames
      : [];
    const rawIndex = event && event.currentTarget && event.currentTarget.dataset
      ? Number(event.currentTarget.dataset.index || 0)
      : 0;
    const nextIndex = Math.max(0, Math.min(Number.isFinite(rawIndex) ? rawIndex : 0, Math.max(frames.length - 1, 0)));
    this.setData({ miniLessonActiveFrameIndex: nextIndex });
  },

  advanceMiniLessonFrame() {
    const receipt = this.data.thinkingReceipt || {};
    const frames = receipt.miniLesson && receipt.miniLesson.blackboard && Array.isArray(receipt.miniLesson.blackboard.frames)
      ? receipt.miniLesson.blackboard.frames
      : [];
    const maxIndex = Math.max(frames.length - 1, 0);
    const nextIndex = Math.min(Number(this.data.miniLessonActiveFrameIndex || 0) + 1, maxIndex);
    this.setData({ miniLessonActiveFrameIndex: nextIndex });
  },

  replayMiniLessonFrame() {
    this.setData({ miniLessonActiveFrameIndex: 0 });
  },

  quickStart() {
    const selected = this.data.selected;
    if (!selected) {
      const state = storage.loadState();
      const first = ((state.homework_plan || {}).must_do || [])[0] || null;
      if (first) {
        storage.set(storage.KEYS.selectedHomework, first);
        storage.set(storage.KEYS.selectedHomeworkSource, 'quick_start_auto');
        this.setData({
          selected: first,
          selectedEvidence: first.evidence || null,
          misconceptionTags: normalizeTags((first.evidence && first.evidence.misconception_tags) || []),
          input: `带我做这项必须做：${first.text}`
        });
        return;
      }
      wx.navigateTo({ url: '/pages/radar/radar' });
      return;
    }
    this.setData({ input: `带我做这项必须做：${selected.text}` });
  },

  pickStep(event) {
    const step = event.currentTarget.dataset.step || 'read_problem';
    const action = QUICK_ACTIONS.find((item) => item.id === step);
    this.setData({
      activeStep: step,
      coachStepLabel: action ? action.label : '读题'
    });
  },

  sendQuick(event) {
    const step = event.currentTarget.dataset.step || this.data.activeStep || 'read_problem';
    const selected = this.data.selected;
    const stepTextMap = {
      read_problem: selected ? `先帮我读题：${selected.text}` : '先帮我读题',
      write_first_step: '我不知道下一步怎么写',
      find_direction: '给我一个方向，但不要直接讲最终结果',
      similar_example: '给我一个相似例子',
      method_summary: '帮我总结方法，做成复习卡',
      fast_mode: selected ? `我想加快一点，只提示方向和第一步。\n${selected.text}` : '我想加快一点，只提示方向和第一步。',
      find_conditions: '带我找条件',
      explain_misconception: '帮我判断错因',
      transfer: '带我做一道举一反三小变式',
      review: '带我做一句话复盘'
    };
    this.setData({
      activeStep: step,
      input: stepTextMap[step] || '带我做下一步'
    });
  },

  startGuidedTutorMode(event) {
    const id = event.currentTarget.dataset.id;
    const mode = GUIDED_TUTOR_MODES.find((item) => item.id === id) || GUIDED_TUTOR_MODES[0];
    const stepMap = {
      homework_coach: 'read_problem',
      wrong_cause: 'explain_misconception',
      transfer: 'transfer',
      parent_rehearsal: 'review'
    };
    const selected = this.data.selected;
    const step = stepMap[mode.id] || 'read_problem';
    const action = QUICK_ACTIONS.find((item) => item.id === step) || QUICK_ACTIONS[0];
    const target = selected && selected.text ? `：${selected.text}` : '';
    this.setData({
      activeStep: step,
      coachStepLabel: action.label,
      input: `${mode.prompt}${target}`
    });
  },

  send() {
    const input = String(this.data.input || '').trim();
    if (!input || this.data.loading) return;

    const state = storage.loadState();
    const selected = this.data.selected;
    const misconceptionText = this.data.misconceptionTags.map((item) => item.label || item.axis).filter(Boolean).join('、');
    const step = this.data.activeStep || 'read_problem';
    const messages = this.data.messages.concat([{ role: 'user', text: input }]);
    this.setData({ messages, input: '', loading: true });
    if (storage.saveTodayFocusFromThought && (selected || input.length >= 4)) {
      storage.saveTodayFocusFromThought(selected && selected.text ? selected.text : input, {
        source: 'tutor',
        stuckPointText: selected && selected.text ? selected.text : input
      });
    }
    const quality = storage.childStepQuality ? storage.childStepQuality(input) : 'empty';
    if (quality !== 'empty' && quality !== 'vague' && !/答案|直接|代写|帮我写|带我|提示|讲一下/.test(input)) {
      storage.saveChildArticulatedStep && storage.saveChildArticulatedStep(input, {
        tutorCompleted: true,
        firstStepQuality: quality,
        firstStepSource: 'child_articulated'
      });
    }

    const localHintLevel = tutorLadder.classifyHintLevel(input, this.data.messages, this.data.currentHintLevel);
    const turnState = tutorLadder.nextTutorTurnState
      ? tutorLadder.nextTutorTurnState(input, this.data.messages, this.data.currentHintLevel, selected)
      : null;
    if (tutorLadder.isAnswerRequest(input) || tutorLadder.isStuckText(input)) {
      this.appendAssistant(tutorLadder.buildTutorReply(input, {
        messages: this.data.messages,
        currentHintLevel: this.data.currentHintLevel,
        selected
      }), turnState);
      return;
    }

    api.checkContent(input).then((check) => {
      if (check && check.safe === false) {
        this.appendAssistant(safetyReply(check, input, selected, step, misconceptionText), turnState);
        return null;
      }
      return api.sendTutorMessage({
        mode: 'homework',
        message: input,
        context: {
          coach_step: step,
          help_mode: step,
          hint_level: localHintLevel,
          hint_ladder: tutorLadder.HINT_LADDER,
          parent_goal: storage.loadParentGoal ? storage.loadParentGoal() : null,
          selected_homework: selected,
          weak_points: state.weak_points || [],
          misconception_tags: this.data.misconceptionTags,
          homework_plan: state.homework_plan || null
        }
        }).then((res) => {
        const localTaskType = tutorLadder.detectTaskType ? tutorLadder.detectTaskType(input, selected) : 'unknown';
        const localPressureSignal = tutorLadder.inferHomeworkPressureSignal
          ? tutorLadder.inferHomeworkPressureSignal(`${input || ''} ${selected && selected.text ? selected.text : ''}`, localTaskType)
          : {};
        const localContract = tutorLadder.buildSocraticAiLocalBoundaryContract
          ? tutorLadder.buildSocraticAiLocalBoundaryContract(localTaskType, localPressureSignal)
          : null;
        const guarded = res && res.reply && !tutorLadder.isAnswerRequest(input) && tutorLadder.guardAiTutorReply
          ? tutorLadder.guardAiTutorReply(res, localContract, {
            userText: input,
            messages: this.data.messages,
            currentHintLevel: localHintLevel,
            selected,
            pressureSignal: localPressureSignal
          })
          : fallbackReply(input, selected, step, misconceptionText);
        this.appendAssistant(guarded, turnState);
        return null;
      });
    }).catch(() => {
      this.appendAssistant(fallbackReply(input, selected, step, misconceptionText), turnState);
    });
  },

  appendAssistant(result, turnState = null) {
    const reply = result && result.reply ? result.reply : '先把你的第一步发来。';
    const next = this.data.messages.concat([{
      role: 'assistant',
      text: reply,
      hint_label: result && result.hint_label ? result.hint_label : ''
    }]);
    const masterySignal = result && result.mastery_signal ? result.mastery_signal : null;
    const coachStep = result && result.coach_step ? result.coach_step : this.data.activeStep;
    const currentHintLevel = result && result.hint_level ? Number(result.hint_level) : this.data.currentHintLevel;
    const mergedTurnState = result && (result.tutor_turn_state || result.tutorTurnState) ? (result.tutor_turn_state || result.tutorTurnState) : turnState;
    storage.set(storage.KEYS.tutorMessages, next.slice(-20));
    const pasteRisk = pasteRiskSignal(next);
    const receipt = buildThinkingReceipt(next, masterySignal, pasteRisk, coachStep, this.data.selected, result && result.real_homework_pressure_signal ? result.real_homework_pressure_signal : null);
    const diagnosticReceipt = Object.assign({}, receipt, {
      turnId: makeReceiptId('tutor_turn'),
      tutor_turn_state: mergedTurnState,
      tutorTurnState: mergedTurnState,
      diagnostic_probe: result && result.diagnostic_probe ? result.diagnostic_probe : null,
      question_type_socratic_path: result && result.question_type_socratic_path ? result.question_type_socratic_path : null,
      socratic_contract: result && result.socratic_contract ? result.socratic_contract : null,
      socratic_fallback_plan: result && result.socratic_fallback_plan ? result.socratic_fallback_plan : null,
      visual_socratic_recovery: result && result.visual_socratic_recovery ? result.visual_socratic_recovery : null,
      fallback_recovery_bridge: result && result.fallback_recovery_bridge ? result.fallback_recovery_bridge : null,
      three_round_socratic_protocol: result && result.three_round_socratic_protocol ? result.three_round_socratic_protocol : null,
      socratic_prompt_quality_judge: result && result.socratic_prompt_quality_judge ? result.socratic_prompt_quality_judge : receipt.socraticPromptQualityJudge || null,
      socratic_ai_local_boundary_contract: result && result.socratic_ai_local_boundary_contract ? result.socratic_ai_local_boundary_contract : receipt.socraticAiLocalBoundaryContract || null,
      socraticAiLocalBoundaryContract: result && result.socraticAiLocalBoundaryContract ? result.socraticAiLocalBoundaryContract : receipt.socraticAiLocalBoundaryContract || null,
      answer_boundary_evidence: result && result.answer_boundary_evidence ? result.answer_boundary_evidence : null,
      allowed_moves: result && result.allowed_moves ? result.allowed_moves : [],
      transfer_prompt: result && result.transfer_prompt ? result.transfer_prompt : ''
    });
    if (storage.appendThinkingReceipt) {
      storage.appendThinkingReceipt(Object.assign({}, diagnosticReceipt, {
        selected_id: this.data.selected && this.data.selected.id,
        selected_text: this.data.selected && this.data.selected.text,
        coach_step: coachStep,
        mastery_status: masterySignal && masterySignal.status,
        risk: pasteRisk.level
      }));
    }
    if (storage.appendValidationEvent && diagnosticReceipt.openMaicInspiredTaskPlanAudit && diagnosticReceipt.openMaicInspiredTaskPlanAudit.ok) {
      storage.appendValidationEvent('openmaic_inspired_task_plan_ready', {
        turnId: diagnosticReceipt.turnId,
        sourcePolicy: diagnosticReceipt.openMaicInspiredTaskPlanAudit.sourcePolicy,
        sceneCount: diagnosticReceipt.openMaicInspiredTaskPlanAudit.sceneCount,
        eventCount: diagnosticReceipt.openMaicInspiredTaskPlanAudit.eventCount,
        gateCount: diagnosticReceipt.openMaicInspiredTaskPlanAudit.gateCount,
        blockedFields: diagnosticReceipt.openMaicInspiredTaskPlanAudit.blockedFields,
        selected_id: this.data.selected && this.data.selected.id,
        selected_text: this.data.selected && this.data.selected.text
      });
    }
    if (storage.recordUnifiedNextAction && diagnosticReceipt.openMaicInspiredTaskPlan && diagnosticReceipt.openMaicInspiredTaskPlan.outline) {
      storage.recordUnifiedNextAction({
        source: 'openmaic_inspired_task_plan',
        sourceLabel: '今晚任务单',
        actionLabel: diagnosticReceipt.openMaicInspiredTaskPlan.outline.firstStep,
        route: '/pages/review/review?from=openmaic_task_plan',
        readiness: 'task_plan_ready',
        capabilityId: 'openmaic_inspired_homework_loop',
        evidence: diagnosticReceipt.openMaicInspiredTaskPlan.outline.evidenceRequired
      });
    }
    const miniLessonTriggered = diagnosticReceipt.miniLesson
      && diagnosticReceipt.miniLesson.trigger
      && diagnosticReceipt.miniLesson.trigger.shouldTrigger
      && diagnosticReceipt.miniLesson.renderGate
      && diagnosticReceipt.miniLesson.renderGate.canRender;
    if (miniLessonTriggered && diagnosticReceipt.miniLessonAudit && diagnosticReceipt.miniLessonAudit.ok) {
      const miniLessonReviewSeed = {
        type: 'three_minute_mini_lesson_review_seed',
        event: 'three_minute_mini_lesson_review_seed',
        source: 'tutor_mini_lesson_trigger',
        status: 'needs_child_exit_ticket',
        route: '/pages/review/review?from=mini_lesson_exit_gate',
        conceptGap: diagnosticReceipt.miniLesson.conceptGap || '',
        topicLabel: diagnosticReceipt.miniLesson.topicCard ? diagnosticReceipt.miniLesson.topicCard.label : '',
        topicCardId: diagnosticReceipt.evidenceThread ? diagnosticReceipt.evidenceThread.topicCardId : '',
        sourceSchemaId: diagnosticReceipt.evidenceThread ? diagnosticReceipt.evidenceThread.sourceSchemaId : '',
        evidenceThread: diagnosticReceipt.evidenceThread || null,
        day7Gate: diagnosticReceipt.evidenceThread ? diagnosticReceipt.evidenceThread.day7Gate : '',
        firstStep: diagnosticReceipt.miniLesson.blackboard ? diagnosticReceipt.miniLesson.blackboard.firstStep : '',
        blackboardFrames: diagnosticReceipt.miniLesson.blackboard && Array.isArray(diagnosticReceipt.miniLesson.blackboard.frames)
          ? diagnosticReceipt.miniLesson.blackboard.frames
          : [],
        parentCheck: diagnosticReceipt.miniLesson.parentCheck || diagnosticReceipt.miniLesson.parentLine || '',
        nextDayReview: diagnosticReceipt.miniLesson.nextDayReview || '',
        exitGate: diagnosticReceipt.miniLesson.exitGate ? diagnosticReceipt.miniLesson.exitGate.passEvidence : 'child_can_say_first_step',
        blockedFields: ['original_question', 'full_answer', 'full_dialogue', 'score', 'ranking', 'talent_label'],
        created_at: Date.now()
      };
      if (storage.appendReviewEvent) {
        storage.appendReviewEvent(miniLessonReviewSeed);
      }
      const miniLessonReturnCard = storage.ensureMiniLessonReturnReviewCard
        ? storage.ensureMiniLessonReturnReviewCard(Object.assign({}, miniLessonReviewSeed, {
          flowTraceId: diagnosticReceipt.flowTraceId || (this.data.selected && this.data.selected.flowTraceId) || '',
          subject: diagnosticReceipt.subject || (this.data.selected && this.data.selected.subject) || '',
          taskType: diagnosticReceipt.taskType || (this.data.selected && this.data.selected.taskType) || ''
        }), {
          source: 'tutor_mini_lesson_trigger',
          turnId: diagnosticReceipt.turnId,
          selectedId: this.data.selected && this.data.selected.id
        })
        : null;
      if (storage.recordUnifiedNextAction) {
        storage.recordUnifiedNextAction({
          source: 'three_minute_mini_lesson',
          sourceLabel: '3 分钟小讲堂',
          actionLabel: miniLessonReviewSeed.firstStep || miniLessonReviewSeed.parentCheck,
          route: miniLessonReviewSeed.route,
          readiness: 'exit_gate_required',
          capabilityId: 'mini_lesson_socratic_fallback',
          evidence: ['mini_lesson_triggered', 'blackboard_frames', 'child_exit_ticket', 'next_day_revisit'],
          subject: diagnosticReceipt.subject || (this.data.selected && this.data.selected.subject) || '',
          taskType: diagnosticReceipt.taskType || ''
        });
      }
      if (storage.appendValidationEvent) {
        storage.appendValidationEvent('three_minute_mini_lesson_triggered', {
          turnId: diagnosticReceipt.turnId,
          conceptGap: miniLessonReviewSeed.conceptGap,
          topicLabel: miniLessonReviewSeed.topicLabel,
          exitGate: miniLessonReviewSeed.exitGate,
          reviewCardId: miniLessonReturnCard && miniLessonReturnCard.id ? miniLessonReturnCard.id : '',
          frameCount: miniLessonReviewSeed.blackboardFrames.length,
          blockedFields: miniLessonReviewSeed.blockedFields
        });
      }
    }
    if (storage.recordAnswerBoundaryEvidence && result && result.answer_boundary_evidence) {
      storage.recordAnswerBoundaryEvidence(result.answer_boundary_evidence, {
        selected_id: this.data.selected && this.data.selected.id,
        selected_text: this.data.selected && this.data.selected.text,
        coach_step: coachStep
      });
    }
    if (storage.trackTutorEvent && result && result.diagnostic_probe) {
      storage.trackTutorEvent('tutor_diagnostic_probe', {
        coach_step: coachStep,
        hint_level: currentHintLevel,
        probe_prompt: result.diagnostic_probe.prompt || '',
        probe_goal: result.diagnostic_probe.goal || '',
        question_type_socratic_path: result.question_type_socratic_path || null,
        question_type_axis: result.question_type_socratic_path && result.question_type_socratic_path.activeAxis,
        question_type_probe_count: result.question_type_socratic_path && Array.isArray(result.question_type_socratic_path.probeBank)
          ? result.question_type_socratic_path.probeBank.length
          : 0,
        question_type_coverage_count: diagnosticReceipt.questionTypeCoverageAtlas && Array.isArray(diagnosticReceipt.questionTypeCoverageAtlas.paths)
          ? diagnosticReceipt.questionTypeCoverageAtlas.paths.length
          : 0,
        question_type_coverage_probes: diagnosticReceipt.questionTypeCoverageAtlas
          ? diagnosticReceipt.questionTypeCoverageAtlas.totalProbeCount
          : 0,
        course_unit_subject: diagnosticReceipt.courseUnitMap && diagnosticReceipt.courseUnitMap.active
          ? diagnosticReceipt.courseUnitMap.active.label
          : '',
        course_unit_label: diagnosticReceipt.activeCourseUnit ? diagnosticReceipt.activeCourseUnit.unitLabel : '',
        course_unit_wrong_cause_count: diagnosticReceipt.activeCourseUnit && Array.isArray(diagnosticReceipt.activeCourseUnit.wrongCauseAtlas)
          ? diagnosticReceipt.activeCourseUnit.wrongCauseAtlas.length
          : 0,
        course_unit_transfer_ladders: diagnosticReceipt.courseUnitQuestionBank && Array.isArray(diagnosticReceipt.courseUnitQuestionBank.activeTransferLadders)
          ? diagnosticReceipt.courseUnitQuestionBank.activeTransferLadders.length
          : 0,
        course_unit_transfer_rungs: diagnosticReceipt.courseUnitQuestionBank
          ? diagnosticReceipt.courseUnitQuestionBank.transferLadderRungCount
          : 0,
        socratic_contract: result.socratic_contract || null,
        socratic_fallback_mode: result.socratic_fallback_plan && result.socratic_fallback_plan.mode,
        visual_recovery_mode: result.visual_socratic_recovery && result.visual_socratic_recovery.recoveryMode,
        visual_recovery_layers: result.visual_socratic_recovery && Array.isArray(result.visual_socratic_recovery.boardLayers)
          ? result.visual_socratic_recovery.boardLayers.length
          : 0,
        visual_recovery_branches: result.visual_socratic_recovery && Array.isArray(result.visual_socratic_recovery.failureBranches)
          ? result.visual_socratic_recovery.failureBranches.length
          : 0,
        fallback_recovery_mode: result.fallback_recovery_bridge && result.fallback_recovery_bridge.mode,
        fallback_recovery_sequence: result.fallback_recovery_bridge && Array.isArray(result.fallback_recovery_bridge.recoverySequence)
          ? result.fallback_recovery_bridge.recoverySequence.length
          : 0,
        fallback_recovery_evidence: result.fallback_recovery_bridge && Array.isArray(result.fallback_recovery_bridge.evidenceRequired)
          ? result.fallback_recovery_bridge.evidenceRequired.length
          : 0,
        three_round_socratic_protocol: result.three_round_socratic_protocol || null,
        three_round_socratic_rounds: result.three_round_socratic_protocol && Array.isArray(result.three_round_socratic_protocol.rounds)
          ? result.three_round_socratic_protocol.rounds.length
          : 0,
        three_round_socratic_fallbacks: result.three_round_socratic_protocol && Array.isArray(result.three_round_socratic_protocol.fallbackBranches)
          ? result.three_round_socratic_protocol.fallbackBranches.length
          : 0,
        three_round_socratic_evidence: result.three_round_socratic_protocol && Array.isArray(result.three_round_socratic_protocol.evidenceRequired)
          ? result.three_round_socratic_protocol.evidenceRequired.length
          : 0,
        socratic_ai_local_boundary_contract: result.socratic_ai_local_boundary_contract || null,
        socratic_ai_local_rows: result.socratic_ai_local_boundary_contract && Array.isArray(result.socratic_ai_local_boundary_contract.runtimeDecisionRows)
          ? result.socratic_ai_local_boundary_contract.runtimeDecisionRows.length
          : 0,
        socratic_ai_local_local_owns: result.socratic_ai_local_boundary_contract && Array.isArray(result.socratic_ai_local_boundary_contract.localOwns)
          ? result.socratic_ai_local_boundary_contract.localOwns
          : [],
        socratic_ai_local_ai_rewrite: result.socratic_ai_local_boundary_contract && Array.isArray(result.socratic_ai_local_boundary_contract.aiMayRewrite)
          ? result.socratic_ai_local_boundary_contract.aiMayRewrite
          : [],
        socratic_prompt_quality_judge: result.socratic_prompt_quality_judge || null,
        prompt_quality_effective_count: result.socratic_prompt_quality_judge && Array.isArray(result.socratic_prompt_quality_judge.effectivePrompts)
          ? result.socratic_prompt_quality_judge.effectivePrompts.length
          : 0,
        prompt_quality_misleading_count: result.socratic_prompt_quality_judge && Array.isArray(result.socratic_prompt_quality_judge.misleadingPrompts)
          ? result.socratic_prompt_quality_judge.misleadingPrompts.length
          : 0,
        prompt_quality_stop_count: result.socratic_prompt_quality_judge && Array.isArray(result.socratic_prompt_quality_judge.stopConditions)
          ? result.socratic_prompt_quality_judge.stopConditions.length
          : 0,
        allowed_moves: result.allowed_moves || [],
        transfer_prompt: result.transfer_prompt || ''
      });
    }
    this.setData({
      messages: next,
      loading: false,
      activeStep: coachStep,
      currentHintLevel,
      tutorTurnState: mergedTurnState,
      coachStepLabel: result && (result.hint_label || result.coach_step_label) ? (result.hint_label || result.coach_step_label) : this.data.coachStepLabel,
      nextAction: result && result.next_action ? result.next_action : this.data.nextAction,
      masterySignal,
      pedagogy: pedagogyPanel(this.data.selected, this.data.misconceptionTags, masterySignal),
      pasteRisk,
      coachConsole: coachConsole(this.data.selected, this.data.misconceptionTags, masterySignal, pasteRisk, coachStep),
      thinkingReceipt: diagnosticReceipt,
      socraticFeedbackStatus: '',
      socraticFeedbackRecordedAt: '',
      socraticFeedbackNextAction: '',
      miniLessonFeedbackBridge: null,
      miniLessonExitGateStatus: '',
      miniLessonExitGateNextRoute: '',
      miniLessonExitGateAction: null,
      miniLessonParentAssistCard: null,
      miniLessonActiveFrameIndex: 0,
      childExitTicketText: ''
    });
    this.syncTutorSignal(masterySignal, coachStep);
  },

  recordSocraticEffectivenessFeedback(event) {
    const status = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.status
      : '';
    const receipt = this.data.thinkingReceipt || {};
    const turnState = this.data.tutorTurnState || receipt.tutorTurnState || receipt.tutor_turn_state || {};
    const item = buildSocraticEffectivenessEvent(status, receipt, turnState);
    const existing = storage.get(storage.KEYS.tutorEvents, []);
    const next = [item].concat(Array.isArray(existing) ? existing : []).slice(0, 160);
    storage.set(storage.KEYS.tutorEvents, next);
    if (storage.appendSyncMutation) {
      storage.appendSyncMutation('socratic_effectiveness_feedback', item);
    }
    const adjustment = buildSocraticFeedbackAdjustment(item, turnState);
    const miniLessonFeedbackBridge = buildMiniLessonFeedbackBridge(item, receipt, adjustment);
    const reviewSeed = {
      type: 'socratic_effectiveness_review_seed',
      event: 'socratic_effectiveness_review_seed',
      status: item.status,
      evidence: adjustment.reviewEvidence,
      seedType: adjustment.reviewSeedType,
      route: '/pages/review/review?from=tutor_feedback',
      nextAction: adjustment.nextAction,
      turnId: item.turnId,
      fallbackId: item.fallbackId,
      hintLevel: adjustment.nextHintLevel,
      coachStep: adjustment.activeStep,
      createdAt: item.createdAt,
      created_at: item.createdAt
    };
    if (storage.appendReviewEvent) {
      storage.appendReviewEvent(reviewSeed);
    }
    let miniLessonReturnCard = null;
    if (miniLessonFeedbackBridge && miniLessonFeedbackBridge.type !== 'parent_handoff_required' && storage.ensureMiniLessonReturnReviewCard) {
      miniLessonReturnCard = storage.ensureMiniLessonReturnReviewCard(miniLessonFeedbackBridge.reviewSeed, {
        source: 'socratic_feedback_still_blocked',
        taskType: miniLessonFeedbackBridge.reviewSeed.taskType || '',
        subject: miniLessonFeedbackBridge.reviewSeed.subject || ''
      });
      if (storage.appendReviewEvent) {
        storage.appendReviewEvent({
          type: 'socratic_feedback_mini_lesson_triggered',
          event: 'socratic_feedback_mini_lesson_triggered',
          route: miniLessonFeedbackBridge.route,
          cardId: miniLessonReturnCard && miniLessonReturnCard.id ? miniLessonReturnCard.id : '',
          evidence: miniLessonFeedbackBridge.evidence,
          nextAction: miniLessonFeedbackBridge.nextAction,
          blockedFields: miniLessonFeedbackBridge.evidence.blockedFields,
          createdAt: item.createdAt,
          created_at: item.createdAt
        });
      }
    } else if (miniLessonFeedbackBridge && miniLessonFeedbackBridge.type === 'parent_handoff_required' && storage.appendReviewEvent) {
      storage.appendReviewEvent({
        type: 'socratic_feedback_parent_handoff_required',
        event: 'socratic_feedback_parent_handoff_required',
        route: miniLessonFeedbackBridge.route,
        evidence: miniLessonFeedbackBridge.evidence,
        nextAction: miniLessonFeedbackBridge.nextAction,
        blockedFields: miniLessonFeedbackBridge.evidence.blockedFields,
        createdAt: item.createdAt,
        created_at: item.createdAt
      });
    }
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction({
        source: 'tutor_socratic_effectiveness_feedback',
        route: reviewSeed.route,
        nextAction: adjustment.nextAction,
        evidence: reviewSeed.evidence,
        subject: turnState.subject || receipt.subject || '',
        taskType: turnState.taskType || receipt.taskType || ''
      });
      if (miniLessonFeedbackBridge) {
        storage.recordUnifiedNextAction({
          source: 'socratic_feedback_mini_lesson_bridge',
          sourceLabel: '苏格拉底卡住后的小讲堂补位',
          actionLabel: miniLessonFeedbackBridge.nextAction,
          route: miniLessonFeedbackBridge.route,
          readiness: 'mini_lesson_triggered_after_stuck_feedback',
          capabilityId: 'three_minute_mini_lesson',
          evidence: ['still_blocked_feedback', 'mini_lesson_trigger', 'exit_gate_required'],
          subject: turnState.subject || receipt.subject || '',
          taskType: turnState.taskType || receipt.taskType || ''
        });
      }
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'tutor',
        dimensionId: 'socratic_effectiveness_feedback',
        evidence: reviewSeed.evidence,
        nextAction: adjustment.nextAction,
        route: reviewSeed.route,
        subject: turnState.subject || receipt.subject || '',
        taskType: turnState.taskType || receipt.taskType || ''
      });
      if (miniLessonFeedbackBridge) {
        storage.recordSurfaceDepthAction({
          surface: 'tutor',
          dimensionId: 'socratic_to_mini_lesson_bridge',
          evidence: 'still_blocked_feedback_triggered_mini_lesson',
          nextAction: miniLessonFeedbackBridge.nextAction,
          route: miniLessonFeedbackBridge.route,
          subject: turnState.subject || receipt.subject || '',
          taskType: turnState.taskType || receipt.taskType || ''
        });
      }
    }
    const adjustedTurnState = Object.assign({}, turnState, {
      hintLevel: adjustment.nextHintLevel,
      feedbackStatus: item.status,
      nextQuestion: adjustment.nextQuestion,
      shouldUseTwoChoice: adjustment.shouldUseTwoChoice,
      evidenceLine: adjustment.releaseLine
    });
    this.setData({
      socraticFeedbackStatus: item.status,
      socraticFeedbackRecordedAt: item.createdAt,
      socraticFeedbackNextAction: adjustment.nextAction,
      currentHintLevel: adjustment.nextHintLevel,
      activeStep: adjustment.activeStep,
      coachStepLabel: adjustment.coachStepLabel,
      nextAction: adjustment.nextAction,
      tutorTurnState: adjustedTurnState,
      miniLessonFeedbackBridge: miniLessonFeedbackBridge ? Object.assign({}, miniLessonFeedbackBridge, {
        reviewCardId: miniLessonReturnCard && miniLessonReturnCard.id ? miniLessonReturnCard.id : ''
      }) : null
    });
    if (typeof wx !== 'undefined' && wx.showToast) {
      wx.showToast({
        title: item.status === 'first_step_spoken' ? '已记录第一步' : '已记录卡点',
        icon: 'none'
      });
    }
  },

  recordMiniLessonExitGate(event) {
    const status = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.status
      : '';
    const passed = status === 'passed';
    const receipt = this.data.thinkingReceipt || {};
    const miniLesson = receipt.miniLesson || {};
    const evidenceThread = receipt.evidenceThread || miniLesson.evidenceThread || {};
    const selected = this.data.selected || {};
    const childExitTicketText = String(this.data.childExitTicketText || '').trim();
    const passedWithChildTicket = passed && !!childExitTicketText;
    const firstStepEvidence = passedWithChildTicket ? childExitTicketText : '';
    const exitGateRecord = storage.recordMiniLessonExitGate
      ? storage.recordMiniLessonExitGate({
        status: passedWithChildTicket ? 'passed' : 'needs_support',
        source: 'tutor_mini_lesson_exit_gate',
        turnId: receipt.turnId || '',
        flowTraceId: receipt.flowTraceId || selected.flowTraceId || '',
        evidenceThread,
        topicCardId: evidenceThread.topicCardId || (miniLesson.topicCard && miniLesson.topicCard.id) || '',
        childExitTicketText,
        firstStepEvidence,
        exitGate: miniLesson.exitGate ? miniLesson.exitGate.passEvidence : 'child_can_say_first_step',
        blockedFields: ['original_question', 'full_answer', 'full_dialogue', 'score', 'ranking', 'talent_label'],
        passRoute: '/pages/review/review?from=mini_lesson_exit_passed',
        failRoute: '/pages/tutor/tutor?from=mini_lesson_exit_needs_support',
        subject: receipt.subject || selected.subject || '',
        taskType: receipt.taskType || selected.taskType || ''
      }, {
        source: 'tutor_mini_lesson_exit_gate',
        selectedId: selected.id || '',
        taskType: selected.taskType || ''
      })
      : null;
    const exitGatePassed = exitGateRecord && exitGateRecord.status === 'passed';
    const exitGateNeedsSupport = !exitGatePassed;
    const nextRoute = exitGateRecord && exitGateRecord.nextRoute
      ? exitGateRecord.nextRoute
      : exitGatePassed ? '/pages/review/review?from=mini_lesson_exit_passed' : '/pages/tutor/tutor?from=mini_lesson_exit_needs_support';
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction({
        source: 'tutor_mini_lesson_exit_gate',
        sourceLabel: '3 分钟小讲堂退出门',
        actionLabel: exitGatePassed ? '明天回访第一步' : '继续降级到家长协助',
        route: nextRoute,
        readiness: exitGatePassed ? 'exit_gate_passed' : 'exit_gate_needs_support',
        capabilityId: 'mini_lesson_exit_gate',
        evidence: ['child_exit_ticket', 'first_step_evidence', 'next_day_revisit'],
        subject: selected.subject || receipt.subject || '',
        taskType: selected.taskType || receipt.taskType || ''
      });
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'tutor',
        dimensionId: 'mini_lesson_exit_gate',
        evidence: exitGatePassed ? 'child_exit_ticket_text' : 'parent_support_needed',
        nextAction: exitGatePassed ? 'next_day_revisit' : 'parent_handoff',
        route: nextRoute,
        subject: selected.subject || receipt.subject || '',
        taskType: selected.taskType || receipt.taskType || ''
      });
    }
    this.setData({
      miniLessonExitGateStatus: exitGatePassed
        ? '已过退出门'
        : (passed ? '缺孩子自己的退出票，转家长协助' : '还不能过，转家长协助'),
      miniLessonExitGateNextRoute: nextRoute,
      miniLessonExitGateAction: {
        label: exitGatePassed ? '去明天回访卡' : '打开家长协助卡',
        route: exitGatePassed ? nextRoute : ((exitGateRecord && exitGateRecord.parentAssistCard && exitGateRecord.parentAssistCard.route) || nextRoute),
        status: exitGatePassed ? 'exit_gate_passed' : 'parent_assist_required'
      },
      miniLessonParentAssistCard: exitGatePassed ? null : ((exitGateRecord && exitGateRecord.parentAssistCard) || null),
      socraticFeedbackStatus: exitGatePassed ? 'first_step_spoken' : 'still_blocked',
      socraticFeedbackNextAction: exitGateNeedsSupport ? '停止加提示，交给家长只问一句' : '明天只回访同一个第一步'
    });
    if (typeof wx !== 'undefined' && wx.showToast) {
      wx.showToast({
        title: exitGatePassed ? '已记录退出门' : '已转家长协助',
        icon: 'none'
      });
    }
  },

  continueMiniLessonExitGateAction() {
    const action = this.data.miniLessonExitGateAction || {};
    const route = action.route || this.data.miniLessonExitGateNextRoute || '/pages/review/review?from=mini_lesson_exit_gate';
    navigation.navigateLearningRoute(route);
  },

  clearChat() {
    const messages = [
      {
        role: 'assistant',
        text: '已清空。继续按规则来：只处理必须做任务和关键错因。'
      }
    ];
    storage.set(storage.KEYS.tutorMessages, messages);
      this.setData({
      messages,
      masterySignal: null,
      nextAction: '先用一句话说清题目真正问什么。',
      tutorTurnState: null,
      thinkingReceipt: Object.assign({}, buildThinkingReceipt(messages, null, pasteRiskSignal(messages), this.data.activeStep, this.data.selected), {
        fallbackId: `clear_${messages.length}_${Date.now()}`
      }),
      socraticFeedbackStatus: '',
      socraticFeedbackRecordedAt: '',
      socraticFeedbackNextAction: '',
      miniLessonFeedbackBridge: null,
      miniLessonExitGateStatus: '',
      miniLessonExitGateNextRoute: '',
      miniLessonExitGateAction: null,
      miniLessonParentAssistCard: null,
      miniLessonActiveFrameIndex: 0
    });
  },

  goRadar() {
    wx.navigateTo({ url: '/pages/radar/radar' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  openEntryDetail(event) {
    const scene = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.scene
      : 'tutor';
    wx.navigateTo({ url: `/pages/entry-detail/entry-detail?scene=${scene || 'tutor'}` });
  },

  goFocus() {
    const session = storage.getTodaySession ? storage.getTodaySession() : null;
    const canStart = storage.canStartFocusFromTodaySession
      ? storage.canStartFocusFromTodaySession(session)
      : !!(session && session.childArticulatedStep);
    if (!canStart) {
      wx.showToast({ title: '先回咕点确认今晚第一步，才能进专注舱。', icon: 'none' });
      return;
    }
    navigation.navigateLearningRoute('/pages/focus/focus');
  },

  goReview() {
    navigation.navigateLearningRoute('/pages/review/review');
  },

  runTutorHandoffAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const route = dataset.route || '/pages/review/review?from=tutor_handoff';
    const action = {
      source: 'tutor_handoff',
      sourceLabel: '点拨后承接',
      actionId: dataset.id || 'repair',
      actionLabel: dataset.label || '修卡点',
      route,
      reasonLine: dataset.reason || '',
      evidenceLine: dataset.evidence || ''
    };
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction(Object.assign({}, action, { surface: 'tutor' }));
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'tutor',
        dimensionId: action.actionId,
        label: action.actionLabel,
        route,
        readiness: 'tutor_handoff',
        capabilityId: action.actionId === 'recall' ? 'game' : action.actionId === 'parent' ? 'parent_action' : 'socratic'
      });
    }
    api.submitEvent({
      event: 'tutor_handoff_action',
      source: 'tutor_receipt',
      page: 'tutor',
      entity_id: action.actionId,
      payload: {
        route,
        action_label: action.actionLabel,
        reason: action.reasonLine,
        evidence: action.evidenceLine
      }
    }).catch(() => {});
    navigation.navigateLearningRoute(route);
  },

  syncTutorSignal(masterySignal, coachStep) {
    if (!masterySignal || !masterySignal.status) return;
    if (this.trackedMasteryStatus === masterySignal.status) return;
    this.trackedMasteryStatus = masterySignal.status;
    const blocked = masterySignal.status === 'blocked_answer_request' || masterySignal.status === 'safety_redirect';
    const eventName = masterySignal.status === 'ready_for_parent_review'
      ? 'tutor_mastery_ready'
      : blocked
        ? 'tutor_blocked'
        : 'tutor_progress';
    const next = storage.trackTutorEvent(eventName, {
      coach_step: coachStep,
      mastery_status: masterySignal.status,
      blocked
    });
    api.submitEvent(next[0]).catch(() => {});
  },
  runSurfaceDepthAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const pack = this.data.surfaceDepthPack || {};
    const route = dataset.route || pack.primaryRoute;
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: pack.surface || dataset.surface || '',
        dimensionId: dataset.dimensionId || '',
        label: dataset.label || '',
        route,
        readiness: pack.surfaceReadiness || ''
      });
    }
    navigation.navigateLearningRoute(route);
  },

  runUnifiedNextAction() {
    const next = this.data.unifiedNextAction || {};
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction(Object.assign({}, next, { surface: 'tutor' }));
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'tutor',
        dimensionId: next.source || 'unified_next_action',
        label: next.actionLabel || '',
        route: next.route || '',
        readiness: 'unified_next_action'
      });
    }
    navigation.navigateLearningRoute(next.route || '/pages/tutor/tutor');
  },

});
