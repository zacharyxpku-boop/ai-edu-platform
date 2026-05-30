const api = require('../../utils/api');
const priority = require('../../utils/learning-priority');
const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');
const privacy = require('../../utils/privacy');
const reviewCards = require('../../utils/review-cards');
const importIntake = require('../../utils/import-intake');
const openMaicInspiredPlan = require('../../utils/openmaic-inspired-plan');
const learningServicePathway = require('../../utils/learning-service-pathway');
const partnerDeliveryWorkbench = require('../../utils/partner-delivery-workbench');

const WRONG_QUESTION_RE = /错题|订正|错因|卡住|不会|总错|做错|漏|粗心|单位|条件|等量关系|建模|符号|公式|审题/;
const MATERIAL_TYPE_ALLOWLIST = [
  'parent_report',
  'talent_assessment',
  'score_sheet',
  'school_material',
  'wrong_question_paper',
  'wrong_question_photo',
  'class_notes',
  'wechat_article',
  'web_article',
  'pdf_excerpt',
  'manual_notes',
  'ppt',
  'video',
  'handwriting'
];

const UPLOAD_DECISION_BLOCKED_FIELDS = [
  'original_answer',
  'full_solution',
  'score',
  'ranking',
  'talent_label',
  'personality_label',
  'private_comment',
  'photo',
  'original_question',
  'full_dialogue',
  'child_name',
  'parent_phone',
  'parent_wechat',
  'contact_info'
];

const UPLOAD_SUBJECT_TASK_PATTERNS = [
  { subjectKey: 'math', subjectLabel: '数学', taskType: 'math_word_problem', match: /数学|应用题|等量|数量关系|方程|列式|几何|函数|面积|体积|比例/ },
  { subjectKey: 'physics', subjectLabel: '物理', taskType: 'physics_diagram', match: /物理|受力|电路|光路|速度|压强|浮力|凸透镜|运动|实验器材/ },
  { subjectKey: 'chemistry', subjectLabel: '化学', taskType: 'chemistry_experiment', match: /化学|方程式|实验|溶液|气体|沉淀|酸碱|质量守恒|微粒|分子/ },
  { subjectKey: 'geography', subjectLabel: '地理', taskType: 'geography_map', match: /地理|地图|经纬|气候|地形|公转|自转|昼夜|季风|等高线/ },
  { subjectKey: 'biology', subjectLabel: '生物', taskType: 'biology_process', match: /生物|细胞|遗传|生态|光合|呼吸|消化|循环|实验过程/ },
  { subjectKey: 'english', subjectLabel: '英语', taskType: 'english_sentence', match: /英语|英文|语法|句型|完形|阅读|单词|时态|从句|作文/ },
  { subjectKey: 'chinese', subjectLabel: '语文', taskType: 'reading_question', match: /语文|阅读理解|古诗|文言|作文|修辞|概括|主旨|背诵/ }
];

function inferUploadSubjectTask(text = '', manual = {}, fallback = {}) {
  const value = [
    manual.subject,
    manual.subjectKey,
    manual.question_type,
    manual.questionType,
    manual.teacher_observation,
    manual.home_observation,
    fallback.sourceSchemaLabel,
    fallback.materialType,
    text
  ].join('\n');
  const matched = UPLOAD_SUBJECT_TASK_PATTERNS.find((item) => item.match.test(value)) || null;
  const subjectKey = String(manual.subjectKey || manual.subject_key || fallback.subjectKey || (matched && matched.subjectKey) || '').trim();
  const subjectLabel = String(manual.subject || manual.subjectLabel || manual.subject_label || fallback.subjectLabel || (matched && matched.subjectLabel) || subjectKey || '').trim();
  const taskType = String(manual.taskType || manual.task_type || fallback.taskType || (matched && matched.taskType) || '').trim();
  return {
    subjectKey,
    subjectLabel,
    taskType,
    inferred: !!matched,
    source: matched ? 'upload_subject_task_pattern' : 'structured_or_schema_fallback'
  };
}

function safeQueryText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch (error) {
    return raw;
  }
}

function uploadPartnerStatusLine(status) {
  const map = {
    pre_sale_needs_real_task_evidence: '待补真实作业证据：只能做报告解读，不能进入合作交付。',
    needs_parent_confirmation: '待家长确认：已有真实证据，交付前必须确认范围。',
    deliverable_after_parent_confirmation: '可受保护交付：只交付行动、家长问题和下一条证据。'
  };
  return map[status] || '待确认交付状态：先补证据和家长确认。';
}

function uploadPartnerGateLine(gate) {
  const map = {
    real_task_evidence_required_before_sales: '放行门槛：先补一条真实错题、作业卡点或家长观察。',
    parent_confirmation_required_before_partner_delivery: '放行门槛：家长确认后才可交付给合作方。',
    parent_confirmed_private_fields_removed: '放行门槛：家长已确认，敏感字段已移除。',
    real_task_evidence_ready_and_parent_confirmed: '放行门槛：真实证据和家长确认均已满足。',
    parent_confirmation_required: '放行门槛：待家长确认交付范围。'
  };
  return map[gate] || String(gate || '').replace(/_/g, ' ');
}

function uploadPartnerFieldLabel(field) {
  const map = {
    tonight_action: '今晚行动',
    parent_question: '家长问题',
    next_evidence: '下一条证据',
    service_candidate: '服务候选',
    original_question: '原题',
    original_answer: '原始答案',
    photo: '照片',
    full_answer: '完整答案',
    full_solution: '完整解法',
    score: '分数',
    ranking: '排名',
    score_ranking: '分数/排名解释',
    talent_label: '天赋定性标签',
    full_dialogue: '完整对话',
    child_name: '孩子姓名',
    parent_phone: '家长手机号',
    parent_wechat: '家长微信',
    contact_info: '联系方式'
  };
  return map[field] || String(field || '').replace(/_/g, ' ');
}

function uploadPartnerFieldLine(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .map(uploadPartnerFieldLabel)
    .filter(Boolean)
    .join('、');
}

function buildUploadPartnerLedgerView(ledger = {}) {
  if (!ledger || !ledger.id) return null;
  return {
    id: 'upload_partner_delivery_readable_ledger',
    statusLine: uploadPartnerStatusLine(ledger.status),
    releaseGateLine: uploadPartnerGateLine(ledger.releaseGate),
    visibleFieldLine: uploadPartnerFieldLine(ledger.partnerVisibleFields),
    blockedFieldLine: uploadPartnerFieldLine(ledger.partnerBlockedFields),
    packageCards: (Array.isArray(ledger.packageCards) ? ledger.packageCards : []).map((item) => ({
      id: item.id,
      label: item.label || '',
      deliverable: item.deliverable || '',
      entryGateLine: uploadPartnerGateLine(item.entryGate),
      routeLine: item.nextRoute ? '下一步入口已准备，确认后可继续。' : '下一步入口待补证据。'
    }))
  };
}

function buildUploadPostPilotRetentionView(loop = {}) {
  if (!loop || !loop.id) return null;
  const statusMap = {
    ready_after_day7_evidence: '7 天后可按证据做保留、降阶或升级判断。',
    locked_until_evidence_and_parent_confirmation: '续航判断先锁住：还缺真实任务证据或家长确认。'
  };
  const stageGateMap = {
    day7_evidence_ready: '门槛：第 7 天证据已完成。',
    pressure_safe_before_more_service: '门槛：先确认压力没有升高。',
    evidence_based_offer_allowed: '门槛：允许基于证据给最小服务建议。',
    locked_until_parent_confirmation: '门槛：家长确认前不推荐服务包。',
    next_evidence_gap_required: '门槛：必须看见下一条证据缺口。'
  };
  return {
    id: 'upload_post_pilot_retention_view',
    title: '7 天后怎么继续',
    statusLine: statusMap[loop.status] || '7 天后只按证据决定下一步。',
    operatorLine: loop.operatorScript || '',
    crmLine: loop.crmFollowup
      ? `CRM 回访：第 ${loop.crmFollowup.day || 7} 天，原因 ${loop.crmFollowup.reason || 'day7_evidence_review'}。`
      : '',
    cards: (Array.isArray(loop.stages) ? loop.stages : []).map((item) => ({
      id: item.id,
      label: item.label || '',
      conditionLine: item.condition || '',
      actionLine: item.action || '',
      gateLine: stageGateMap[item.gate] || `门槛：${item.gate || '证据足够后再继续'}`
    })),
    safetyLine: Array.isArray(loop.safetyRules) && loop.safetyRules.length
      ? `不做：${loop.safetyRules.join(' / ')}`
      : '不做结果承诺、天赋标签、原题答案外传或无证据升级。',
    evidenceLine: Array.isArray(loop.evidenceRequired) && loop.evidenceRequired.length
      ? `需要证据：${loop.evidenceRequired.join(' / ')}`
      : '需要真实任务、家长确认、第 7 天验证和下一证据缺口。'
  };
}

function buildUploadPersonalizedClosureView(bridge = {}) {
  if (!bridge || !bridge.id) return null;
  const routeLine = (Array.isArray(bridge.endToEndRoutes) ? bridge.endToEndRoutes : [])
    .map((item) => `${item.id}:${item.gate}`)
    .join(' -> ');
  return {
    id: 'upload_personalized_closure_view',
    title: '个性化闭环执行桥',
    statusLine: bridge.status === 'ready_for_guided_execution'
      ? '已具备真实任务证据：可以进入原小点、修卡点、回访和家长报告。'
      : '先补真实任务证据：资料/成绩只能生成方法候选，不能直接放行游戏或服务。',
    contentLine: `内容密度：${bridge.contentScalePlan ? bridge.contentScalePlan.density : 'pending'}；题型：${bridge.questionType || 'unknown'}；学科：${bridge.subject || 'unknown'}`,
    socraticLine: bridge.socraticStressFallback
      ? `苏格拉底兜底：${bridge.socraticStressFallback.fallbackOrder.join(' / ')}`
      : '',
    gameLine: bridge.gameRetentionPlan
      ? `游戏留存：${bridge.gameRetentionPlan.openedGameRecall ? '可进入回访练习' : '先锁定，等第一步/错因/隔天回访'}；XP 门槛 ${bridge.gameRetentionPlan.xpGate}`
      : '',
    scoreLine: bridge.scoreReportBridge
      ? `成绩报告：只用于 ${bridge.scoreReportBridge.useScoreFor.join(' / ')}，不用于 ${bridge.scoreReportBridge.neverUseScoreFor.join(' / ')}`
      : '',
    uploadLine: bridge.uploadMaterialBridge
      ? `上传资料：${bridge.uploadMaterialBridge.aiContractRequired ? '需要 AI 合同+本地兜底' : '本地兜底'}；${bridge.uploadMaterialBridge.localFallback}`
      : '',
    routeLine,
    releaseLine: Array.isArray(bridge.releaseGates) ? `放行门槛：${bridge.releaseGates.join(' / ')}` : '',
    evidenceLine: Array.isArray(bridge.evidenceRequired) ? `证据：${bridge.evidenceRequired.join(' / ')}` : '',
    blockedLine: Array.isArray(bridge.blockedFields) ? `不外显：${bridge.blockedFields.slice(0, 8).map(uploadPartnerFieldLabel).join('、')}` : '',
    lockedLine: Array.isArray(bridge.lockedBecause) && bridge.lockedBecause.length
      ? `待补：${bridge.lockedBecause.join(' / ')}`
      : '当前没有阻断项，但仍需按本地规则放行。'
  };
}

function buildUploadServiceHandoffPack(options = {}) {
  const sourceSchemaId = options.sourceSchemaId || '';
  const servicePathway = options.servicePathway || {};
  const tonightTaskCard = options.tonightTaskCard || {};
  const validationPlanView = options.validationPlanView || {};
  const productTierView = options.productTierView || {};
  const partnerWorkbench = options.partnerWorkbench || {};
  const hasRealTaskEvidence = !!options.hasRealTaskEvidence;
  const parentConfirmed = !!options.parentConfirmed;
  const primaryTier = servicePathway.primaryTier || (productTierView.cards && productTierView.cards[0]) || {};
  const validationCount = Array.isArray(validationPlanView.cards) ? validationPlanView.cards.length : 0;
  const advisorNext = Array.isArray(partnerWorkbench.advisorQueue)
    ? (partnerWorkbench.advisorQueue.find((item) => item.status === 'todo') || partnerWorkbench.advisorQueue[0] || {})
    : {};
  const assessmentOnly = sourceSchemaId === 'talent_assessment';
  return {
    id: 'upload_family_solution_handoff_pack',
    title: '家庭解决方案交付包',
    summaryLine: assessmentOnly
      ? '当前只放行“学习方法候选”，需要用真实错题和回访验证后再进入训练。'
      : '当前可以从材料进入“今晚动作 -> 7 天验证 -> 家长复盘/合作交付”的闭环。',
    cards: [
      {
        id: 'diagnosis_basis',
        label: '诊断依据',
        line: hasRealTaskEvidence
          ? '已有孩子自己的第一步、错因或错题材料，可以进入低压执行。'
          : '证据还偏薄，先补一条真实作业卡点，避免用测评或观察直接下结论。',
        evidenceLine: assessmentOnly ? '测评只作为方法候选，不贴天赋标签。' : '只使用本次材料里的可复核线索。'
      },
      {
        id: 'tonight_execution',
        label: '今晚执行',
        line: tonightTaskCard.firstStep || '先让孩子说出第一步，不追完整答案。',
        evidenceLine: tonightTaskCard.parentCheck || '家长只问一个可观察问题。'
      },
      {
        id: 'seven_day_validation',
        label: '7 天验证',
        line: validationCount ? `已生成 ${validationCount} 天验证动作。` : '先补第一步和错因，再开放 7 天验证。',
        evidenceLine: validationPlanView.successLine || '隔天回访和第 7 天小变式齐全后，才进入长期画像。'
      },
      {
        id: 'partner_delivery',
        label: '合作交付',
        line: parentConfirmed
          ? '家长已确认交付范围，可以只交付行动、问题和下一证据。'
          : '合作方交付前需要家长确认范围，并移除原题、答案、分数、隐私信息。',
        evidenceLine: advisorNext.action || primaryTier.promise || '下一步按证据补齐情况决定服务包。'
      }
    ],
    releaseLine: '放行标准：不靠单次测评定性；必须有孩子自己的第一步、错因、回访或家长确认。',
    blockedLine: '不交付：原题照片、完整答案、分数排名、天赋定性、完整对话和联系方式。'
  };
}

function buildUploadScoreSignalView(reportState = {}, reportDraft = {}, decisionSource = {}) {
  const parsedScores = Object.assign({},
    reportState.parsedScores || {},
    reportDraft.parsedScores || {},
    decisionSource.parsedScores || {}
  );
  const parsedRanks = Object.assign({},
    reportState.parsedRanks || {},
    reportDraft.parsedRanks || {},
    decisionSource.parsedRanks || {}
  );
  const subjectRows = Object.keys(parsedScores).map((key) => parsedScores[key]).filter(Boolean).slice(0, 5);
  const released = subjectRows.length > 0;
  return {
    id: 'upload_score_signal_view',
    status: released ? 'confirmed_score_reference' : 'no_confirmed_score_reference',
    confirmedScores: released ? { parsedScores, parsedRanks } : null,
    subjectLine: released
      ? `confirmed subjects: ${subjectRows.map((item) => `${item.subject || ''}${item.score ? ` ${item.score}` : ''}`).join(' / ')}`
      : 'confirmed subjects: none; do not infer scores from assessment or parent observation',
    rankLine: parsedRanks && (parsedRanks.classRank || parsedRanks.totalScore)
      ? `rank/total only as confirmed reference: ${parsedRanks.classRank || '-'} / ${parsedRanks.totalScore || '-'}`
      : 'rank/total: not released unless explicit score sheet exists',
    useLine: released
      ? 'use scores only to choose next evidence and weak subject, not to promise score improvement'
      : 'ask for one score sheet or one real wrong question before score-based planning',
    blockedLine: 'blocked: score comparison, ranking marketing, guaranteed improvement'
  };
}

function buildUploadContentCoverageReceipt(decisionSource = {}, evidenceSignals = {}) {
  let matrix = null;
  try {
    matrix = storage.buildRealHomeworkCoverageMatrix ? storage.buildRealHomeworkCoverageMatrix() : null;
  } catch (_) {
    matrix = null;
  }
  const subject = evidenceSignals.subjectLabel || evidenceSignals.subjectKey || decisionSource.subjectLabel || decisionSource.subjectKey || '';
  const taskType = evidenceSignals.taskType || decisionSource.taskType || evidenceSignals.questionType || '';
  const sampleCount = Number(matrix && (matrix.totalSamples || matrix.loadedSampleCount || matrix.sampleCount) || 0);
  const subjectCount = Number(matrix && (matrix.totalSubjects || (Array.isArray(matrix.subjectRows) ? matrix.subjectRows.length : 0)) || 0);
  const typeCount = Number(matrix && (matrix.totalTypes || (Array.isArray(matrix.typeRows) ? matrix.typeRows.length : 0)) || 0);
  return {
    id: 'upload_content_coverage_receipt',
    status: matrix && matrix.coverageConfidence === 'fixture_verified' ? 'fixture_verified' : 'local_rule_only',
    coverageLine: sampleCount
      ? `coverage: ${sampleCount} verified homework samples / ${subjectCount || 7} subjects / ${typeCount || 9} task types`
      : 'coverage: local strategy only; needs more verified homework samples',
    matchLine: subject || taskType
      ? `current match: ${subject || 'unknown subject'} / ${taskType || 'unknown task type'}`
      : 'current match: collect subject and task type before stronger recommendation',
    weakLine: 'weak area remains real content scale: expand verified chapter-task samples before claiming Khan/Gizmo-level breadth',
    fallbackLine: 'fallback: first-step Socratic question, mini blackboard, next-day revisit; no full answer or answer bank'
  };
}

function buildUploadAiMaterialSolutionView(contract = {}, sourceSchemaId = '', options = {}) {
  const fallback = contract && contract.fallback ? contract.fallback : {};
  const confidence = fallback.evidenceConfidence || {};
  const analysisQuality = fallback.analysisQuality || {};
  const nextAction = fallback.nextAction || {};
  const executionPath = fallback.executionPath || {};
  const blockedClaims = Array.isArray(fallback.blockedClaims) ? fallback.blockedClaims : [];
  const releaseGates = Array.isArray(contract.releaseGates) ? contract.releaseGates : [];
  const scoreSignalView = options.scoreSignalView || {};
  const contentCoverageReceipt = options.contentCoverageReceipt || {};
  const requiredEvidence = Array.isArray(confidence.requiredNextEvidence) && confidence.requiredNextEvidence.length
    ? confidence.requiredNextEvidence
    : ['structured_evidence', 'parent_confirmation'];
  const confidenceLevel = confidence.level || 'low';
  return {
    id: 'upload_ai_material_solution_view',
    title: 'AI analysis to action',
    statusLine: contract && contract.endpointPath
      ? `server endpoint: ${contract.endpointPath}; fallback: ${fallback.status || 'local_guarded_draft'}`
      : 'local guarded draft until server analysis is configured',
    subjectLine: `subject: ${fallback.subject || 'unknown'}`,
    wrongCauseLine: `wrong-cause candidate: ${fallback.wrongCause || 'needs one real task check'}`,
    firstStepLine: `first step: ${fallback.firstStep || 'ask the child to name the first step'}`,
    learningPreferenceLine: `method hypothesis: ${fallback.learningPreference || 'validate before practice'}`,
    confidenceLine: `evidence confidence: ${confidenceLevel}; ${confidence.reason || 'parent confirmation required'}`,
    qualityLine: analysisQuality.status
      ? `quality gate: ${analysisQuality.status}; score ${Number(analysisQuality.score || 0)}; missing ${(analysisQuality.missingEvidence || []).join(' / ') || 'none'}`
      : 'quality gate: local fallback until server analysis is verified',
    nextActionLine: `next action: ${nextAction.label || fallback.firstStep || 'go to Socratic first step'}`,
    nextActionRoute: nextAction.route || executionPath.socraticRoute || '/pages/tutor/tutor?from=ai_material_analysis',
    scoreLine: scoreSignalView.subjectLine || 'confirmed subjects: none; score sheet not yet released',
    scoreUseLine: scoreSignalView.useLine || 'scores can guide evidence collection only after explicit confirmation',
    coverageLine: contentCoverageReceipt.coverageLine || 'coverage: local first-step strategy until verified content match is available',
    coverageFallbackLine: contentCoverageReceipt.fallbackLine || 'fallback: Socratic first step and next-day revisit',
    routes: [
      { id: 'socratic', label: 'Socratic', route: executionPath.socraticRoute || '/pages/tutor/tutor?from=ai_material_analysis' },
      { id: 'mini_lesson', label: 'Mini lesson', route: executionPath.miniLessonRoute || '/pages/tutor/tutor?from=ai_material_analysis_mini_lesson' },
      { id: 'game_recall', label: 'Game recall', route: executionPath.gameRecallRoute || '/pages/arcade/arcade?from=ai_material_analysis' },
      { id: 'parent_review', label: 'Parent review', route: executionPath.parentReviewRoute || '/pages/profile/profile?from=ai_material_analysis' }
    ],
    releaseLine: releaseGates.length
      ? `release gates: ${releaseGates.slice(0, 4).join(' / ')}`
      : 'release gates: sanitizer / parent confirmation / real homework evidence',
    evidenceLine: `next evidence: ${requiredEvidence.slice(0, 4).join(' / ')}`,
    blockedLine: blockedClaims.length
      ? `blocked claims: ${blockedClaims.slice(0, 5).join(' / ')}`
      : 'blocked claims: talent label / auto grading / OCR claim / full answer / ranking',
    sourceSchemaId
  };
}

function buildUploadDailyExecutionSeed(options = {}) {
  const aiView = options.aiMaterialSolutionView || {};
  const tonightTaskCard = options.tonightTaskCard || {};
  const scoreSignalView = options.scoreSignalView || {};
  const contentCoverageReceipt = options.contentCoverageReceipt || {};
  const reportId = options.reportId || '';
  const sourceSchemaId = options.sourceSchemaId || 'upload_material';
  const query = `from=upload_daily_seed&reportId=${encodeURIComponent(reportId)}&sourceSchemaId=${encodeURIComponent(sourceSchemaId)}`;
  const gameRoute = options.gameRoute || '';
  const reviewRoute = `/pages/review/review?${query}`;
  const tutorRoute = options.actionRoute || aiView.nextActionRoute || `/pages/tutor/tutor?${query}`;
  const subjectLine = scoreSignalView.subjectLine || aiView.subjectLine || 'subject: pending evidence';
  const coverageLine = contentCoverageReceipt.coverageLine || aiView.coverageLine || 'coverage: local first-step strategy';
  const firstStep = tonightTaskCard.firstStep || aiView.firstStepLine || 'ask the child to say the first step';
  const wrongCause = tonightTaskCard.wrongCause || aiView.wrongCauseLine || 'name one wrong-cause candidate';
  const gameUnlocked = !!gameRoute;
  return {
    id: 'upload_daily_execution_seed',
    title: '上传资料后的每日执行种子',
    subjectLine,
    coverageLine,
    todayLine: `今天只做一件事：${firstStep}`,
    tomorrowLine: '明天回来只复述第一步和错因，再决定是否放行新题。',
    wrongCauseLine: `错因线索：${wrongCause}`,
    reviewRoute,
    tutorRoute,
    gameRoute,
    gameLine: gameUnlocked
      ? '游戏回访已解锁：只练主动回忆，不奖励速度、分数或同伴比较。'
      : '游戏回访暂不解锁：先补孩子第一步或错因证据。',
    releaseLine: '放行规则：有第一步 + 错因 + 明天回访证据，才进入游戏或分享。',
    blockedLine: '不带原题、完整答案、分数、名次、天赋标签、孩子姓名或联系方式。',
    evidenceRequired: ['child_first_step', 'wrong_cause_named', 'next_day_revisit', 'parent_check'],
    syncPayload: {
      report_id: reportId,
      source_schema_id: sourceSchemaId,
      review_route: reviewRoute,
      tutor_route: tutorRoute,
      game_route: gameRoute,
      game_unlocked: gameUnlocked,
      evidence_required: 'child_first_step,wrong_cause_named,next_day_revisit,parent_check'
    }
  };
}

function uploadValidationEvidenceLine(evidence) {
  const map = {
    first_step: '证据：孩子能先说第一步，而不是等答案。',
    parent_observation: '证据：家长只记录一次可观察动作。',
    tomorrow_recall: '证据：隔天仍能复述同一张卡的第一步。',
    near_transfer: '证据：换一个小变式也能开口。',
    review_result: '证据：复盘中能说明错因是否减少。',
    family_feedback: '证据：家长确认压力没有升高。',
    next_service_decision: '证据：用 7 天记录决定是否进入服务包。'
  };
  return map[evidence] || `证据：${String(evidence || '补一条可复核证据').replace(/_/g, ' ')}`;
}

function buildUploadValidationPlanView(plan = [], sourceSchemaId = '') {
  const cards = (Array.isArray(plan) ? plan : []).slice(0, 7).map((item, index) => {
    const day = Number(item.day || index + 1);
    return {
      id: item.id || `day_${day}`,
      label: item.label || `第 ${day} 天`,
      action: item.action || '完成一个低压学习动作。',
      evidenceLine: uploadValidationEvidenceLine(item.evidence),
      gateLine: item.locked
        ? '放行状态：先补真实作业卡点，再继续后续验证。'
        : (item.unlockRule ? `放行状态：${item.unlockRule}` : '放行状态：可执行。'),
      acceptanceLine: day >= 7 || item.evidence === 'near_transfer'
        ? '通过标准：能迁移到小变式，才进入长期画像或服务建议。'
        : '通过标准：孩子能自己说出第一步，家长不需要代做。',
      stopLine: '停止条件：一旦变成要答案、排名或焦虑承诺，退回第一步点拨。'
    };
  });
  const assessmentOnly = sourceSchemaId === 'talent_assessment';
  return {
    id: 'upload_seven_day_validation_delivery_view',
    title: '7 天验证交付单',
    summaryLine: assessmentOnly
      ? '测评只生成方法候选；必须用真实错题和第 7 天小变式验证。'
      : '本次材料进入 7 天验证；每天只留一条可复核证据。',
    successLine: '交付标准：今晚动作、隔天回访、第 7 天小变式三项齐全，才允许进入下一阶段服务。',
    cards
  };
}

function buildUploadProductTierView(tiers = []) {
  const cards = (Array.isArray(tiers) ? tiers : []).map((tier) => {
    const blockedClaims = Array.isArray(tier.blockedClaims) ? tier.blockedClaims : [];
    return {
      id: tier.id || tier.label || 'service_tier',
      label: tier.label || '行动交付包',
      promise: tier.promise || '围绕真实学习证据安排下一步。',
      entryGateLine: tier.entryGate
        ? `准入条件：${tier.entryGate}`
        : '准入条件：先有真实学习证据和家长确认。',
      deliverableLine: `交付内容：${tier.promise || '今晚行动、回访证据和下一阶段建议。'}`,
      blockedClaimsLine: blockedClaims.length
        ? `禁止承诺：${blockedClaims.slice(0, 4).join('、')}`
        : '禁止承诺：不承诺提分、不贴标签、不替代老师判断。',
      evidenceLine: '转化依据：只看真实作业、回访和第 7 天小变式，不看焦虑话术。'
    };
  });
  return {
    id: 'upload_product_tier_delivery_view',
    title: '可交付服务包',
    summaryLine: '服务包只从证据放行，不从测评标签或焦虑承诺放行。',
    cards
  };
}

function uploadModeEntryLine(route = '') {
  const value = String(route || '');
  if (value.indexOf('/pages/tutor/') >= 0) return '进入方式：先回到一对一点拨，孩子说第一步。';
  if (value.indexOf('/pages/review/') >= 0) return '进入方式：先修复一张错因卡，再安排回访。';
  if (value.indexOf('/pages/arcade/') >= 0) return '进入方式：做 90 秒主动回忆，不新增题量。';
  if (value.indexOf('/pages/profile/') >= 0) return '进入方式：家长先看报告和证据，不直接给孩子贴标签。';
  return '进入方式：从当前材料继续下一步。';
}

function uploadModeEvidenceLine(mode = {}) {
  const id = mode.id || '';
  if (id === 'three_minute_mini_lesson') return '退出证据：孩子能用自己的话说出口袋小结。';
  if (id === 'game_recall') return '退出证据：隔天还能回忆第一步或错因。';
  if (id === 'wrong_question_repair_course') return '退出证据：同类错因少一次，且能说出修正动作。';
  if (id === 'online_method_course') return '退出证据：方法候选必须被真实错题验证。';
  return '退出证据：留下孩子第一步、家长一句话和下一次回访。';
}

function buildUploadModeRecommendationView(modes = []) {
  const cards = (Array.isArray(modes) ? modes : []).map((mode, index) => ({
    id: mode.id || `mode_${index + 1}`,
    label: mode.label || '学习模式',
    roleLine: index === 0 ? '推荐角色：今晚默认优先。' : '推荐角色：作为补充路径。',
    actionLine: mode.action || '先完成一个低压动作。',
    reasonLine: mode.localGate ? `为什么推荐：${mode.localGate}` : '为什么推荐：当前材料已有可执行证据。',
    entryLine: uploadModeEntryLine(mode.route),
    evidenceLine: uploadModeEvidenceLine(mode),
    boundaryLine: '边界：不直接给答案、不承诺提分、不替代老师判断。'
  }));
  return {
    id: 'upload_mode_recommendation_delivery_view',
    title: '今晚学习模式',
    summaryLine: '默认仍是一对一苏格拉底点拨；小课堂、游戏和课程只在证据满足时补位。',
    cards
  };
}

function uploadModeReleaseGateLine(gate = '') {
  const value = String(gate || '');
  if (value.indexOf('real_task_evidence') >= 0) return '放行门槛：先补一条真实作业证据。';
  if (value.indexOf('parent_confirmation') >= 0) return '放行门槛：家长确认范围后再进入服务交付。';
  return '放行门槛：先完成孩子第一步和下一条回访证据。';
}

function buildUploadModeChoiceProtocolView(protocol = {}) {
  if (!protocol || !protocol.id) return null;
  return {
    id: 'upload_mode_choice_protocol_view',
    title: protocol.title || '学习模式选择',
    positioningLine: protocol.positioningLine || '默认是一对一点拨，其他模式只做补位。',
    releaseGateLine: uploadModeReleaseGateLine(protocol.releaseGate),
    choiceCards: (Array.isArray(protocol.choiceCards) ? protocol.choiceCards : []).map((item, index) => ({
      id: item.id || `choice_${index + 1}`,
      label: item.label || '学习模式',
      roleLine: item.recommended ? '推荐：今晚优先使用。' : '可选：有证据后再补充。',
      childChoiceLine: item.childCanChoose ? '孩子可选择，但必须留下退出证据。' : (item.lockReason || '暂不让孩子直接选择。'),
      exitLine: `退出证据：${item.exitEvidenceRequired || '孩子第一步和一次回访。'}`,
      parentLine: item.parentConfirmRequired ? '家长确认后再进入交付。' : '先完成孩子第一步。'
    })),
    blockedModeCards: (Array.isArray(protocol.blockedModeCards) ? protocol.blockedModeCards : []).map((item, index) => ({
      id: item.id || `blocked_${index + 1}`,
      label: item.label || '暂不开启模式',
      lockLine: item.lockReason || '证据不足，暂不开启。',
      unlockLine: item.localGate ? `开启条件：${item.localGate}` : '开启条件：补足真实作业卡点和回访证据。',
      exitLine: `退出证据：${item.exitEvidenceRequired || '孩子能说明第一步。'}`
    }))
  };
}

function uploadQuickAssessmentGateLine(releaseRule = '') {
  const value = String(releaseRule || '');
  if (value.indexOf('real_task') >= 0 || value.indexOf('day_7') >= 0) {
    return '放行门槛：15 题只给方法候选；必须补真实错题，并完成第 7 天小变式验证。';
  }
  return '放行门槛：先补一条真实学习证据，再决定是否进入下一步。';
}

function uploadQuickAssessmentEntryLine(route = '') {
  const value = String(route || '');
  if (value.indexOf('/pages/upload/') >= 0) return '进入方式：回到资料入口补充观察、错题或学校反馈。';
  if (value.indexOf('/pages/tutor/') >= 0) return '进入方式：回到一对一点拨，让孩子先说第一步。';
  return '进入方式：从当前报告继续补齐证据。';
}

function buildUploadQuickAssessmentBridgeView(bridge = {}) {
  if (!bridge || !bridge.id) return null;
  return {
    id: 'upload_quick_assessment_bridge_view',
    title: '没有现成测评时',
    label: bridge.label || '15 题快速了解学习偏好',
    useWhenLine: bridge.useWhen || '当家长没有完整测评资料时，用短问题先形成方法候选。',
    gateLine: uploadQuickAssessmentGateLine(bridge.releaseRule),
    entryLine: uploadQuickAssessmentEntryLine(bridge.route),
    evidenceLine: '需要补的证据：一条真实错题、一次孩子第一步、一条家长观察。',
    boundaryLine: '边界：不贴天赋标签，不做长期定性，不把问卷结果当作固定分数预期。'
  };
}

function uploadReleaseRuleLine(rule = '') {
  const value = String(rule || '');
  if (/talent|assessment/.test(value)) {
    return '放行门槛：测评只给方法候选，必须补真实错题后再进入练习。';
  }
  if (/structured|evidence|material/.test(value)) {
    return '放行门槛：先补孩子第一步、错因猜测和下一条回访证据。';
  }
  if (/parent|confirm/.test(value)) {
    return '放行门槛：家长确认交付范围后再继续。';
  }
  return '放行门槛：先补一条真实学习证据。';
}

function uploadReturnRouteLine(route = '') {
  const value = String(route || '');
  if (value.indexOf('/pages/profile/') >= 0) return '下一步：查看家长报告和证据边界。';
  if (value.indexOf('/pages/tutor/') >= 0) return '下一步：回到一对一点拨，让孩子先说第一步。';
  if (value.indexOf('/pages/review/') >= 0) return '下一步：回到错因复盘，锁定明天回访。';
  if (value.indexOf('/pages/arcade/') >= 0) return '下一步：做 90 秒主动回忆，不新增压力。';
  if (value.indexOf('/pages/upload/') >= 0) return '下一步：继续补材料证据。';
  return '下一步入口已准备，确认后继续。';
}

function buildUploadSourceReadinessView(board = {}) {
  if (!board) return null;
  const nextEvidence = Array.isArray(board.nextEvidence) ? board.nextEvidence : [];
  return {
    id: 'upload_source_readiness_readable_view',
    gateLine: uploadReleaseRuleLine(board.releaseRule),
    nextEvidence,
    aiLine: board.aiBetterLine ? `AI 负责：${board.aiBetterLine}` : 'AI 负责：把方法候选改写成孩子能听懂的话。',
    localLine: board.localCodeBetterLine ? `本地规则负责：${board.localCodeBetterLine}` : '本地规则负责：证据、隐私、放行和回访。',
    blockedLine: board.mustNotDoLine ? `不能做：${board.mustNotDoLine}` : '不能做：贴标签、自动判分、输出完整答案。'
  };
}

function uploadReadableListLine(label, values = []) {
  const list = Array.isArray(values) ? values : [values];
  const text = list.map((item) => String(item || '').trim()).filter(Boolean).join('、');
  return `${label}：${text || '按当前材料补齐后再显示。'}`;
}

function buildUploadAiLocalDeliveryView(split = []) {
  const cards = (Array.isArray(split) ? split : []).map((item, index) => ({
    id: item.id || `ai_local_${index + 1}`,
    label: item.label || '交付边界',
    reasonLine: item.reason || '这一步需要明确谁负责，避免把安全判断交给临场生成。',
    ownsLine: uploadReadableListLine('负责内容', item.owns),
    familyLine: item.id === 'ai_expression_layer'
      ? '家长可期待：表达更自然、追问更贴近孩子，但不替孩子完成题目。'
      : item.id === 'local_release_gate'
        ? '家长可期待：隐私、放行、奖励和分享都先过规则闸门。'
        : '家长可期待：AI 给方法候选，本地证据决定是否继续。',
    boundaryLine: '边界：AI 不负责贴标签、放答案、发奖励或决定商业转化。'
  }));
  return {
    id: 'upload_ai_local_delivery_readable_view',
    title: 'AI / 规则分工',
    summaryLine: 'AI 负责把话说清楚；本地规则负责安全、放行和证据闭环。',
    cards
  };
}

function uploadPublicAssetEntryLine(route = '') {
  const value = String(route || '');
  if (value.indexOf('/pages/tutor/') >= 0) return '进入方式：转成第一步点拨或小黑板。';
  if (value.indexOf('/pages/profile/') >= 0) return '进入方式：沉淀到家长报告和复盘证据。';
  if (value.indexOf('/pages/arcade/') >= 0) return '进入方式：转成主动回忆卡，不复制原题。';
  if (value.indexOf('/pages/upload/') >= 0) return '进入方式：先补材料来源和家长确认。';
  return '进入方式：先登记来源，再决定是否进入学习任务。';
}

function buildUploadPublicK12BorrowView(playbook = []) {
  const cards = (Array.isArray(playbook) ? playbook : []).map((item, index) => ({
    id: item.id || `public_asset_${index + 1}`,
    label: item.label || '公开资料',
    bestUseLine: `适合怎么借力：${item.bestUse || '只做结构参考，不直接复制内容。'}`,
    localGuardLine: uploadReadableListLine('本地规则守住', item.localCodeOwns),
    aiUseLine: uploadReadableListLine('AI 可辅助', item.aiBetterFor),
    blockedLine: uploadReadableListLine('禁止做', item.mustNotUse),
    entryLine: uploadPublicAssetEntryLine(item.route)
  }));
  return {
    id: 'upload_public_k12_borrow_readable_view',
    title: '公开资料借力边界',
    summaryLine: '公开资料只借结构、题型和表达方式；不复制原文、不包装成自有题库、不输出整套答案。',
    cards
  };
}

function normalizeMaterialType(query = {}, fallback = 'class_notes') {
  const raw = safeQueryText(query.type || query.materialType || query.sourceSchemaId || query.source || '');
  const normalized = raw.replace(/^material_/, '');
  return MATERIAL_TYPE_ALLOWLIST.includes(normalized) ? normalized : fallback;
}

function buildMaterialTypeGuide(type) {
  const guides = {
    talent_assessment: {
      examplePlaceholder: '粘贴测评摘要即可：\n测评说孩子偏视觉型，听讲容易走神；\n最近数学应用题能说题意，但第一步不愿意写；\n家长想验证：先画图再列式是否更稳。',
      statusLine: '当前只生成方法候选，不生成复习卡、不贴天赋标签、不提高画像置信度。',
      modeLine: '验证方式：今晚一题试方法，明天问一句，第 7 天再看小变式。',
      blockedClaimsLine: '不能做：天赋定性、性格判断、排名解释、长期能力结论。'
    },
    score_sheet: {
      examplePlaceholder: '粘贴成绩单/周测文字即可：\n六年级数学 82，应用题扣 10 分，计算扣 3 分；\n英语阅读慢，完形错 4 个；\n家长想知道先补哪一类题、今晚先做什么。',
      statusLine: '当前只把成绩作为家长私有优先级信号；不做公开排名、不发 XP、不承诺提分。',
      modeLine: '验证方式：用分数定位弱学科，再用一张真实错题确认错因和第一步。',
      blockedClaimsLine: '不能做：排名营销、分数刺激、不承诺分数结果、把成绩写进分享卡。'
    },
    wrong_question_paper: {
      examplePlaceholder: '粘贴错题摘要即可：\n题型：六年级应用题，等量关系；\n孩子原想法：看到“多 3 倍”就直接乘；\n卡住第一步：不知道先设谁；\n错因猜测：条件顺序和单位混在一起。',
      statusLine: '当前生成错因报告、第一步小黑板和近迁移，不自动判分、不给整卷答案。',
      modeLine: '验证方式：先补“孩子原想法 / 卡住第一步 / 错因猜测”，再进入修卡点。',
      blockedClaimsLine: '不能做：OCR 识别承诺、自动批改、整卷解析、原题答案外发。'
    },
    wrong_question_photo: {
      examplePlaceholder: '照片只做本地证据，请补一句文字：\n这张错题是应用题；\n孩子说“我不知道先设哪个量”；\n我怀疑错在等量关系。',
      statusLine: '当前只把照片作为本地证据，必须有文字卡点后才生成小讲堂或回访卡。',
      modeLine: '验证方式：照片留档 + 一句卡点 + 一句错因，组合成错题修复资产。',
      blockedClaimsLine: '不能做：夸大识别能力、替孩子作答、自动给完整答案。'
    },
    school_material: {
      examplePlaceholder: '粘贴老师反馈即可：\n老师说课堂能听懂，但作业列式慢；\n建议家长先看孩子能否复述题意；\n本周重点是应用题条件整理。',
      statusLine: '当前生成家校摘要和家庭下一步，不替老师下判断、不改学校要求。',
      modeLine: '验证方式：把老师反馈转成今晚一句检查话术和明天一张回访卡。',
      blockedClaimsLine: '不能做：替老师评价、生成考试结论、公开孩子表现。'
    },
    parent_report: {
      examplePlaceholder: '粘贴家长观察即可：\n晚上 8 点后容易拖拉；\n遇到应用题会急，说“我不会”；\n如果先复述题意，情绪会稳定一点。',
      statusLine: '当前生成家庭决策书和低压陪伴话术，不给孩子贴能力标签。',
      modeLine: '验证方式：今晚只验证一个动作，明天看孩子是否能少卡一步。',
      blockedClaimsLine: '不能做：能力定性、情绪诊断、家庭教育评判。'
    },
    wechat_article: {
      examplePlaceholder: '粘贴公众号摘录：\n二次函数顶点式可以从一般式配方得到；\n先找对称轴，再看开口方向和顶点坐标；\n孩子卡在“为什么要配方”。',
      statusLine: '当前只处理粘贴摘录，不自动抓取链接。',
      modeLine: '验证方式：摘成概念卡、步骤卡、陷阱卡和填空卡。',
      blockedClaimsLine: '不能做：自动爬取全文、替代原文版权内容、直接给答案。'
    },
    web_article: {
      examplePlaceholder: '粘贴网页摘录，不只贴链接：\n一元一次方程移项要变号；\n例子：3x + 5 = 20，先把常数项移到右边；\n孩子卡在“为什么变号”。',
      statusLine: '当前只处理你粘贴的网页摘录，不自动打开或抓取链接。',
      modeLine: '验证方式：先变成本地复习卡，再接一道近迁移。',
      blockedClaimsLine: '不能做：自动抓网页、生成全文搬运、越过来源边界。'
    },
    pdf_excerpt: {
      examplePlaceholder: '粘贴 PDF / 图片报告里已经提取出来的文字：\n报告摘要：孩子更依赖图像线索，遇到长题容易跳读；\n成绩：数学 82，应用题扣分集中；\n错题：列式前没有先圈条件。',
      statusLine: 'PDF/OCR 只作为文字提取前置；提取后必须进入 AI 分析 + 本地安全校验，不直接给结论。',
      modeLine: '验证方式：AI 生成报告草案，本地只放行方法候选、第一步、7 天行动和家长确认。',
      blockedClaimsLine: '不能做：承诺自动读完整 PDF、OCR 秒判、整卷解析、直接输出题解。'
    }
  };
  return guides[type] || {
    examplePlaceholder: '粘贴课堂笔记、PPT 要点或手动整理：\n今天讲了什么概念；\n老师强调了哪一步；\n孩子具体卡在哪里。',
    statusLine: '当前生成本地复习卡和轻练习，不承诺自动解析文件或直接出答案。',
    modeLine: '验证方式：先拆成概念、步骤、陷阱、填空四类卡。',
    blockedClaimsLine: '不能做：自动抓取、自动批改、完整答案生成。'
  };
}

function buildUploadEntryDeck(activeMode = 'homework') {
  const entries = [
    {
      id: 'homework',
      label: '填今晚作业',
      title: '今晚先排顺序',
      line: '写题型、数量和时间，马上生成必做/灵活/后置。',
      placeholder: '例如：\n数学方程基础题 8 道；\n应用题 4 道，写完整过程；\n英语听写 20 个词。',
      cta: '写作业清单'
    },
    {
      id: 'stuck',
      label: '补一句卡点',
      title: '卡住先救第一步',
      line: '只写孩子卡在哪，不需要完整题目；系统会接到苏格拉底点拨和小讲堂。',
      placeholder: '例如：\n错题订正：应用题卡在等量关系；\n孩子原想法：看到“多 3 倍”就直接乘；\n我只想先知道第一步看哪里。',
      cta: '写卡点一句'
    },
    {
      id: 'material',
      label: '粘贴材料摘录',
      title: '材料先过边界',
      line: '粘贴测评、错题、老师反馈或摘录；不抓链接、不判整卷、不贴天赋标签。',
      placeholder: '先在下方粘贴材料摘录；只处理你贴的文字，不自动解析文件。',
      cta: '粘贴材料'
    }
  ].map((item) => Object.assign({}, item, { active: item.id === activeMode }));
  const active = entries.find((item) => item.active) || entries[0];
  return {
    title: '今晚三步录入',
    summary: '先选一种入口：作业清单、卡点一句、材料摘录。选完直接进入今晚第一步。',
    entries,
    active,
    activeMode: active.id,
    placeholder: active.placeholder,
    nextLine: active.id === 'material'
      ? '下面会打开材料区；先贴摘录，再生成家长报告/复习卡/回访卡。'
      : active.id === 'stuck'
        ? '下面只要补一句卡点；系统会优先生成第一步点拨和小讲堂触发证据。'
        : '下面写作业清单；系统会先排今晚必做和第一步。'
  };
}

Page({
  data: {
    imagePaths: [],
    materialFiles: [],
    homeworkText: '',
    materialText: '',
    materialType: 'class_notes',
    uploadEntryMode: 'homework',
    uploadEntryDeck: buildUploadEntryDeck('homework'),
    homeworkPlaceholder: buildUploadEntryDeck('homework').placeholder,
    minutes: 35,
    previewPlan: null,
    materialPreview: null,
    showMaterialPanel: false,
    showPlanDetails: false,
    uploadPlaybook: null,
    inputCoach: null,
    uploadIntakePacket: null,
    materialIntakePacket: null,
    structuredEvidenceCapture: null,
    lastReportCta: null,
    submitLabel: '生成今晚作业三分类',
    quickChips: [
      { label: '语文背诵', text: '语文背诵 1 篇，孩子容易卡在开头。' },
      { label: '整理错题', text: '错题订正：题目写这里；我错在审题/等量关系/单位换算；想要举一反三。' },
      { label: '数学试卷', text: '数学试卷订正，应用题卡在等量关系。' },
      { label: '英语听写', text: '英语听写 20 个单词，需要先过易错词。' }
    ],
    submitting: false,
    surfaceDepthPack: null,
    unifiedNextAction: null
  },

  toggleMaterialPanel() {
    this.setData({ showMaterialPanel: !this.data.showMaterialPanel });
  },

  setUploadEntryMode(event) {
    const mode = event.currentTarget.dataset.mode || 'homework';
    const nextMode = ['homework', 'stuck', 'material'].includes(mode) ? mode : 'homework';
    const deck = buildUploadEntryDeck(nextMode);
    const patch = {
      uploadEntryMode: nextMode,
      uploadEntryDeck: deck,
      homeworkPlaceholder: deck.placeholder
    };
    if (nextMode === 'material') {
      patch.showMaterialPanel = true;
      patch.materialType = this.data.materialType || 'class_notes';
    }
    this.setData(patch);
    if (nextMode === 'material') {
      this.updateMaterialPreview(this.data.materialText, patch.materialType);
    }
  },

  togglePlanDetails() {
    this.setData({ showPlanDetails: !this.data.showPlanDetails });
  },

  onLoad(query = {}) {
    const state = storage.loadState();
    const profile = storage.loadProfile();
    const draft = storage.get ? storage.get(storage.KEYS.taskDraft, null) : null;
    const homeworkText = draft && draft.text ? draft.text : this.data.homeworkText;
    const routeMaterialType = normalizeMaterialType(query, this.data.materialType);
    const routeMaterialText = safeQueryText(query.materialText || query.text || '');
    const shouldOpenMaterialPanel = !!(query.type || query.materialType || query.sourceSchemaId || routeMaterialText);
    this.setData({
      minutes: (state.homework_plan && state.homework_plan.minutes_available) || profile.minutes || 35,
      homeworkText,
      uploadEntryMode: shouldOpenMaterialPanel ? 'material' : this.data.uploadEntryMode,
      uploadEntryDeck: buildUploadEntryDeck(shouldOpenMaterialPanel ? 'material' : this.data.uploadEntryMode),
      homeworkPlaceholder: buildUploadEntryDeck(shouldOpenMaterialPanel ? 'material' : this.data.uploadEntryMode).placeholder,
      materialType: routeMaterialType,
      materialText: routeMaterialText,
      showMaterialPanel: shouldOpenMaterialPanel || this.data.showMaterialPanel,
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('upload') : null,
      unifiedNextAction: storage.buildUnifiedNextActionController ? storage.buildUnifiedNextActionController({ surface: 'upload' }) : null
    });
    this.updatePreview(homeworkText, (state.homework_plan && state.homework_plan.minutes_available) || profile.minutes || 35);
    this.updateMaterialPreview(routeMaterialText, routeMaterialType);
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
    const pendingRoute = navigation.consumePendingTabRouteContext
      ? navigation.consumePendingTabRouteContext('/pages/upload/upload')
      : null;
    if (!pendingRoute) {
      return;
    }
    const options = pendingRoute.options || {};
    const routeMaterialType = normalizeMaterialType(options, this.data.materialType);
    const routeMaterialText = safeQueryText(options.materialText || options.text || '');
    const shouldOpenMaterialPanel = !!(options.type || options.materialType || options.sourceSchemaId || routeMaterialText);
    this.setData({
      uploadEntryMode: shouldOpenMaterialPanel ? 'material' : this.data.uploadEntryMode,
      uploadEntryDeck: buildUploadEntryDeck(shouldOpenMaterialPanel ? 'material' : this.data.uploadEntryMode),
      homeworkPlaceholder: buildUploadEntryDeck(shouldOpenMaterialPanel ? 'material' : this.data.uploadEntryMode).placeholder,
      materialType: routeMaterialType,
      materialText: routeMaterialText,
      showMaterialPanel: shouldOpenMaterialPanel || this.data.showMaterialPanel
    });
    if (shouldOpenMaterialPanel) {
      this.updateMaterialPreview(routeMaterialText, routeMaterialType);
    }
  },

  buildUploadPlaybook(plan, state, minutes) {
    const weak = ((state && state.weak_points) || [])[0] || null;
    const summary = (plan && plan.summary) || {};
    return {
      title: '今晚作业先分流',
      label: '把作业清单粘进来，先看哪些必须做、哪些有余力再做、哪些今晚可以放过。',
      stats: [
        { label: '必须做', value: plan ? plan.must_do.length : 0 },
        { label: '可省时间', value: `${summary.saved_minutes || 0} 分钟` },
        { label: '今晚时间', value: `${minutes || 35} 分钟` }
      ],
      cards: [
        {
          id: 'weak',
          title: '优先照顾的卡点',
          body: weak ? `${weak.name} ${weak.score} 分` : '还没有卡点数据，先录入一次作业。',
          tone: 'focus'
        },
        {
          id: 'preview',
          title: '下一步会发生什么',
          body: plan && plan.must_do[0]
            ? `第一项必须做会自动进入作业点拨：${plan.must_do[0].text}`
            : '至少写一项作业，就能预览今晚第一件该做的事。',
          tone: 'next'
        },
        {
          id: 'memory',
          title: '为什么不是白做',
          body: '必须做和关键错因会进入今晚安排、作业点拨和轻回访，变成后面还能用的学习资产。',
          tone: 'record'
        }
      ]
    };
  },

  buildMaterialPreview(text, type) {
    const value = String(text || '').trim();
    const guide = buildMaterialTypeGuide(type);
    const labels = {
      parent_report: '家长观察',
      talent_assessment: '天赋/学习偏好测评',
      score_sheet: '成绩单/周测',
      school_material: '学校/老师材料',
      wrong_question_paper: '错题/试卷',
      wrong_question_photo: '错题照片留档',
      class_notes: '课堂笔记',
      ppt: 'PPT 要点',
      video: '视频笔记',
      handwriting: '手写整理',
      wechat_article: '公众号摘录',
      web_article: '网页摘录',
      pdf_excerpt: 'PDF/图片报告文字',
      manual_notes: '手动整理'
    };
    const sourceLine = `来源：${labels[type] || '课堂笔记'}`;
    const importBoundary = '只处理你粘贴的文字摘录，不自动抓取链接、不解析 PDF 文件，也不生成现成答案。';
    if (!value) {
      const methodMode = type === 'talent_assessment' || type === 'score_sheet' || type === 'school_material' || type === 'wrong_question_paper' || type === 'parent_report' || type === 'pdf_excerpt';
      return {
        title: '学习材料变复习卡',
        label: methodMode
          ? '可以粘贴天赋/学习偏好测评、老师反馈、错题试卷或家长观察；系统先做证据分流，不贴标签、不出完整答案。'
          : '先粘贴公众号/网页摘录、PDF 摘录、课堂笔记或 PPT 要点，预览能不能变成可复习的知识卡。',
        type: labels[type] || '课堂笔记',
        sourceLine,
        importBoundary,
        examplePlaceholder: guide.examplePlaceholder,
        statusLine: guide.statusLine,
        modeLine: guide.modeLine,
        blockedClaimsLine: guide.blockedClaimsLine,
        cards: [],
        readiness: 0,
        nextAction: methodMode
          ? '粘贴一段真实材料后，会生成来源账本、下一证据、家长报告入口和 AI/本地分工。'
          : '粘贴一段真实摘录，咕点会先生成概念卡、步骤卡、陷阱卡和填空卡。'
      };
    }
    const intakePacket = importIntake.buildUploadIntakePacket(value, this.data.imagePaths, type);
    const profile = storage.loadProfile();
    const cards = reviewCards.previewImport(value, {
      subject: profile.subject || '',
      source: `material_${type || 'class_notes'}`
    }).slice(0, 6);
    const coreTypes = ['concept', 'step', 'trap', 'cloze'];
    const covered = coreTypes.filter((cardType) => cards.some((item) => item.cardType === cardType)).length;
    return {
      title: '材料预览',
      label: '把零散材料拆成概念、步骤、陷阱和填空卡，先形成一套本地可用的复习包。',
      type: labels[type] || '课堂笔记',
      sourceLine,
      importBoundary,
      examplePlaceholder: guide.examplePlaceholder,
      statusLine: guide.statusLine,
      modeLine: guide.modeLine,
      blockedClaimsLine: guide.blockedClaimsLine,
      cards,
      readiness: Math.min(100, Math.round((covered / coreTypes.length) * 80) + Math.min(20, cards.length * 3)),
      sourceReadinessBoard: intakePacket.sourceReadinessBoard || null,
      sourceReadinessView: buildUploadSourceReadinessView(intakePacket.sourceReadinessBoard || null),
      nextAction: cards.length
        ? `已预览 ${cards.length} 张卡，可以导入长期复习。`
        : '再补一点具体步骤、易错陷阱或例题，卡片会更有用。'
    };
  },

  updatePreview(text, minutes) {
    const state = storage.loadState();
    const trimmed = String(text || '').trim();
    const uploadIntakePacket = importIntake.buildUploadIntakePacket(trimmed, this.data.imagePaths, this.data.materialType);
    const previewPlan = trimmed
      ? priority.classifyHomework(trimmed, state.weak_points || [], Number(minutes || 35))
      : null;
    this.setData({
      previewPlan,
      uploadPlaybook: this.buildUploadPlaybook(previewPlan, state, Number(minutes || 35)),
      inputCoach: this.buildInputCoach(trimmed, previewPlan),
      uploadIntakePacket,
      submitLabel: this.buildSubmitLabel(trimmed)
    });
  },

  buildSubmitLabel(text) {
    return this.extractWrongQuestionLines(text).length
      ? '整理错题本并规划今晚'
      : '生成今晚作业三分类';
  },

  buildInputCoach(text, plan) {
    const lines = String(text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const hasStuckPoint = /卡|错|不会|忘|慢|不懂|总|粗心|陷阱|单位|步骤|关系/.test(text);
    const wrongLines = this.extractWrongQuestionLines(text);
    const hasCount = /\d/.test(text);
    const score = Math.min(100,
      (lines.length ? 34 : 0)
      + (lines.length >= 3 ? 22 : 0)
      + (hasCount ? 20 : 0)
      + (hasStuckPoint ? 24 : 0));
    const next = !lines.length
      ? '先写 3 行：题型、数量、卡住点。'
      : !hasStuckPoint
        ? '再补一句孩子卡在哪里，分类会更可信。'
        : !hasCount
          ? '再补题目数量或预计时间，咕点才能算减负。'
          : '可以生成三分类了。';
    return {
      score,
      next,
      wrongCount: wrongLines.length,
      wrongbookLabel: wrongLines.length
        ? `已识别 ${wrongLines.length} 条错题，会整理进错题本`
        : '写“错题/订正/错因”，可自动生成错题本和举一反三',
      checks: [
        { id: 'lines', label: '至少 3 行任务', ready: lines.length >= 3 },
        { id: 'count', label: '有题量/时间', ready: hasCount },
        { id: 'stuck', label: '写出卡住点', ready: hasStuckPoint },
        { id: 'wrongbook', label: '错题可回访', ready: wrongLines.length > 0 },
        { id: 'preview', label: '已生成预览', ready: !!plan }
      ]
    };
  },

  extractWrongQuestionLines(text) {
    return String(text || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 6 && WRONG_QUESTION_RE.test(line))
      .slice(0, 8);
  },

  buildWrongQuestionText(lines, state, plan) {
    const firstMust = plan && plan.must_do && plan.must_do[0];
    const evidence = (firstMust && firstMust.evidence) || {};
    const weak = evidence.weak_point || ((state && state.weak_points) || [])[0] || {};
    return lines.map((line, index) => [
      `错题 ${index + 1}: ${line}`,
      `错因: ${weak.name || '先定位审题、概念、步骤或计算中的具体卡点'}`,
      '举一反三: 换一个条件时，先说第一步和最容易错的检查点。'
    ].join('\n')).join('\n\n');
  },

  importWrongQuestionsToReview(text, state, plan) {
    const lines = this.extractWrongQuestionLines(text);
    if (!lines.length) return { imported: 0, skipped: 0, detected: 0 };
    const firstMust = plan && plan.must_do && plan.must_do[0];
    const evidence = (firstMust && firstMust.evidence) || {};
    const weak = evidence.weak_point || ((state && state.weak_points) || [])[0] || {};
    const profile = storage.loadProfile();
    return reviewCards.importTextToDeck(this.buildWrongQuestionText(lines, state, plan), {
      subject: (state && state.subject) || profile.subject || '',
      weakPoint: weak.name || '错题本',
      calibrationKey: evidence.calibration_key || `wrongbook:${Date.now()}`,
      source: 'mini-upload-wrong-question',
      sourceSchemaId: 'wrong_question_paper',
      reportSourceId: 'wrong_question_paper',
      uploadMaterialType: 'wrong_question_paper',
      reportId: `upload_wrong_question_${Date.now ? Date.now() : 0}`,
      flowTraceId: `upload_wrong_question:${evidence.calibration_key || (Date.now ? Date.now() : 0)}`,
      requiredNextEvidence: [
        { id: 'child_original_thought', label: '孩子原想法', route: '/pages/tutor/tutor?from=wrong_question_evidence', owner: 'ai_with_local_guardrail', unlocks: 'socratic_first_step' },
        { id: 'stuck_first_step', label: '卡住第一步', route: '/pages/tutor/tutor?from=wrong_question_evidence', owner: 'local_rule', unlocks: 'wrong_cause_card' },
        { id: 'next_day_revisit', label: '明天回访结果', route: '/pages/review/review', owner: 'local_rule', unlocks: 'portrait_confidence_plus_one' }
      ]
    });
  },

  previewWrongQuestionsToReview(text) {
    const lines = this.extractWrongQuestionLines(text);
    return {
      imported: lines.length,
      skipped: 0,
      detected: lines.length,
      previewOnly: true
    };
  },

  saveFocusFromUploadText(text, state, plan) {
    if (!storage.saveTodayFocusFromThought) return null;
    const wrongLines = this.extractWrongQuestionLines(text);
    const firstMust = plan && plan.must_do && plan.must_do[0];
    const evidence = (firstMust && firstMust.evidence) || {};
    const weak = evidence.weak_point || ((state && state.weak_points) || [])[0] || {};
    const focusText = wrongLines[0] || text;
    if (!focusText || !/卡住|卡在|不会|不懂|错因|错题|审题|列式|单位|步骤|关系|公式/.test(focusText)) {
      return null;
    }
    const focus = storage.saveTodayFocusFromThought(focusText, {
      source: 'mini-upload',
      subject: (state && state.subject) || '',
      issueType: weak.name || evidence.relatedIssueType || undefined
    });
    if (focus && focus.isStuck && storage.updateTonightRouteStatus) {
      storage.updateTonightRouteStatus('focus_created', { focusId: focus.id });
    }
    return focus;
  },

  buildDecisionSource(uploadIntakePacket, text, wrongbook = {}, reportSeed = {}) {
    const packet = uploadIntakePacket || {};
    const seed = reportSeed || {};
    const imported = !!wrongbook.imported;
    const subjectTask = inferUploadSubjectTask(text, {}, {
      sourceSchemaLabel: seed.sourceSchemaLabel || packet.sourceSchemaLabel || '',
      materialType: this.data.materialType || ''
    });
    return {
      sourceSchemaId: seed.sourceSchemaId || (imported ? 'wrong_question_paper' : 'parent_report'),
      sourceSchemaLabel: seed.sourceSchemaLabel || (imported ? '错题/试卷' : '家长观察'),
      subjectKey: subjectTask.subjectKey,
      subjectLabel: subjectTask.subjectLabel,
      taskType: subjectTask.taskType,
      subjectTaskInferenceSource: subjectTask.source,
      inputChannel: packet.kind || 'upload_text',
      hasText: !!String(text || '').trim(),
      imageCount: Number(packet.imageCount || (this.data.imagePaths || []).length || 0),
      confidence: Number(seed.confidence || (imported ? 0.78 : 0.58)),
      requiresParentConfirmation: true,
      releaseScope: seed.releaseScope || (imported ? 'tonight_action_first' : 'observation_only'),
      portraitConfidenceWeight: Number(seed.portraitConfidenceWeight || (imported ? 1 : 0)),
      evidenceGap: Array.isArray(seed.evidenceGap) ? seed.evidenceGap : [],
      requiredNextEvidence: Array.isArray(seed.requiredNextEvidence) ? seed.requiredNextEvidence : [],
      nextEvidenceUnlockPlan: seed.nextEvidenceUnlockPlan || '',
      methodValidationChallengeChain: seed.methodValidationChallengeChain || packet.methodValidationChallengeChain || null,
      sourceReadinessBoard: packet.sourceReadinessBoard || null,
      blockedFields: Array.from(new Set([].concat(
        Array.isArray(packet.blockedFields) ? packet.blockedFields : [],
        UPLOAD_DECISION_BLOCKED_FIELDS
      )))
    };
  },

  buildStructuredEvidenceSignals(uploadIntakePacket = {}, text = '', manual = {}) {
    const schema = uploadIntakePacket.intakeSourceSchema || {};
    const prompts = Array.isArray(uploadIntakePacket.structuredCapturePrompts)
      ? uploadIntakePacket.structuredCapturePrompts
      : [];
    const value = String(text || '');
    const pickLine = (patterns) => {
      const lines = value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      return lines.find((line) => patterns.some((pattern) => pattern.test(line))) || '';
    };
    const manualValues = manual && typeof manual === 'object' ? manual : {};
    const promptValueById = {};
    prompts.forEach((prompt) => {
      const id = prompt && prompt.id ? prompt.id : '';
      if (id) promptValueById[id] = String(manualValues[id] || '').trim();
    });
    const questionType = pickLine([/题型|类型|阅读|应用题|实验|方程|证明|语法|地图|过程/]);
    const childOriginalThought = pickLine([/原想法|当时想|孩子说|第一反应|我以为|我觉得/]);
    const stuckFirstStep = pickLine([/第一步|卡住|不会下手|先看|先找|先画|先列/]);
    const wrongCauseGuess = pickLine([/错因|错在|扣分|粗心|单位|条件|关系|概念|审题/]);
    const questionTypeValue = String(manualValues.question_type || manualValues.questionType || '').trim()
      || promptValueById.question_type
      || promptValueById.preference_candidate
      || promptValueById.teacher_observation
      || promptValueById.home_observation
      || questionType;
    const childOriginalThoughtValue = String(manualValues.child_original_thought || manualValues.childOriginalThought || '').trim()
      || promptValueById.child_original_thought
      || promptValueById.method_hypothesis
      || promptValueById.classroom_signal
      || promptValueById.parent_goal
      || childOriginalThought;
    const stuckFirstStepValue = String(manualValues.stuck_first_step || manualValues.firstStep || manualValues.stuckFirstStep || '').trim()
      || promptValueById.stuck_first_step
      || promptValueById.cross_check_gate
      || promptValueById.home_school_question
      || promptValueById.homework_context
      || promptValueById.first_step
      || stuckFirstStep;
    const wrongCauseGuessValue = String(manualValues.wrong_cause_guess || manualValues.wrongCause || manualValues.wrongCauseGuess || '').trim()
      || promptValueById.wrong_cause_guess
      || promptValueById.review_window
      || promptValueById.safe_handoff
      || promptValueById.next_action
      || promptValueById.wrong_cause
      || promptValueById.next_day_revisit
      || promptValueById.day7_variant
      || wrongCauseGuess;
    const subjectTask = inferUploadSubjectTask(value, Object.assign({}, manualValues, promptValueById), {
      sourceSchemaLabel: schema.label || uploadIntakePacket.sourceSchemaLabel || '',
      materialType: uploadIntakePacket.sourceType || uploadIntakePacket.sourceSchemaId || ''
    });
    const structuredCapture = {
      sourceSchemaId: schema.id || uploadIntakePacket.sourceSchemaId || '',
      sourceSchemaLabel: schema.label || uploadIntakePacket.sourceSchemaLabel || '',
      subjectKey: subjectTask.subjectKey,
      subjectLabel: subjectTask.subjectLabel,
      taskType: subjectTask.taskType,
      subjectTaskInferenceSource: subjectTask.source,
      questionType: questionTypeValue || schema.label || '',
      childOriginalThought: childOriginalThoughtValue,
      stuckFirstStep: stuckFirstStepValue,
      wrongCauseGuess: wrongCauseGuessValue,
      missing: prompts
        .filter((prompt) => !String(promptValueById[prompt.id] || '').trim())
        .map((prompt) => prompt.label || prompt.id)
    };
    return {
      structuredCapture,
      questionType: questionTypeValue || schema.label || '',
      childOriginalThought: childOriginalThoughtValue,
      firstStep: stuckFirstStepValue || '',
      stuckFirstStep: stuckFirstStepValue || '',
      wrongCause: wrongCauseGuessValue || '',
      wrongCauseGuess: wrongCauseGuessValue,
      subjectKey: subjectTask.subjectKey,
      subjectLabel: subjectTask.subjectLabel,
      taskType: subjectTask.taskType,
      subjectTaskInferenceSource: subjectTask.source,
      sourceSchemaId: schema.id || '',
      sourceSchemaLabel: schema.label || '',
      structuredCaptureMissing: structuredCapture.missing,
      structuredCapturePrompts: prompts,
      structuredFieldValues: promptValueById
    };
  },

  isSpecificEvidenceValue(fieldId = '', value = '', sourceSchemaId = '') {
    const text = String(value || '').trim();
    if (text.length < 6) return false;
    if (/^(不知道|没有|一般|还行|待验证|看情况|需要观察|方法候选|ok|none|n\/a)$/i.test(text)) return false;
    if (/不知道|说不清|随便|以后再说|暂无|没有证据/.test(text)) return false;
    if (sourceSchemaId === 'talent_assessment') {
      if (fieldId === 'method_hypothesis') {
        return /今晚|先|第一步|作业|错题|试|复述|画图|拆步|动笔/.test(text);
      }
      if (fieldId === 'cross_check_gate') {
        return /错题|作业|回访|第\s*7\s*天|小变式|第一步|验证|复述/.test(text);
      }
    }
    if (sourceSchemaId === 'wrong_question_paper') {
      if (fieldId === 'child_original_thought') return /孩子|他说|我以为|当时|原话|先/.test(text);
      if (fieldId === 'stuck_first_step') return /第一步|卡|先|找|画|列|读题|条件|关系/.test(text);
    }
    if (sourceSchemaId === 'parent_report') {
      return /晚上|作业|家长|孩子|先|明天|回访|检查|陪|问/.test(text);
    }
    return true;
  },

  buildStructuredEvidenceCapture(uploadIntakePacket = {}, text = '', manual = {}) {
    const signals = this.buildStructuredEvidenceSignals(uploadIntakePacket, text, manual);
    const prompts = Array.isArray(uploadIntakePacket.structuredCapturePrompts)
      ? uploadIntakePacket.structuredCapturePrompts
      : [];
    const sourceSchemaId = signals.sourceSchemaId || uploadIntakePacket.sourceSchemaId || '';
    const aliasValues = sourceSchemaId === 'wrong_question_paper'
      ? {
        question_type: signals.questionType || '',
        child_original_thought: signals.childOriginalThought || '',
        stuck_first_step: signals.stuckFirstStep || '',
        wrong_cause_guess: signals.wrongCauseGuess || '',
        wrong_cause: signals.wrongCauseGuess || '',
        first_step: signals.stuckFirstStep || '',
        next_day_revisit: signals.wrongCauseGuess || '',
        day7_variant: signals.wrongCauseGuess || ''
      }
      : {};
    const values = Object.assign({}, aliasValues, signals.structuredFieldValues || {}, manual || {});
    const fields = prompts.map((prompt) => {
      const value = String(values[prompt.id] || '').trim();
      const ready = this.isSpecificEvidenceValue(prompt.id, value, sourceSchemaId);
      return Object.assign({}, prompt, {
        value,
        ready,
        qualityIssue: value && !ready ? 'need_specific_real_task_evidence' : '',
        placeholder: prompt.prompt || '补一条真实证据，不写结论。'
      });
    });
    const readyCount = fields.filter((item) => item.ready).length;
    const missing = fields.filter((item) => !item.ready).map((item) => item.label || item.id);
    return {
      title: '材料证据补全',
      summary: '不同材料补不同证据：测评补方法假设，学校材料补家校交接，家长观察补今晚动作，错题补第一步和错因。',
      releaseGate: '本地规则决定报告、游戏和分享是否放行；AI 只改写追问和家长摘要。',
      fields,
      values,
      readyCount,
      totalCount: fields.length,
      missing,
      ready: fields.length > 0 && readyCount === fields.length,
      nextAction: missing.length
        ? `还差：${missing.slice(0, 2).join(' / ')}`
        : '证据已补齐，可以生成家长决策报告。'
    };
  },

  mergeStructuredEvidenceText(text = '', capture = null) {
    const value = String(text || '').trim();
    const fields = capture && Array.isArray(capture.fields) ? capture.fields : [];
    const extra = fields
      .filter((field) => String(field.value || '').trim())
      .map((field) => `${field.label || field.id}: ${String(field.value || '').trim()}`);
    return [value].concat(extra).filter(Boolean).join('\n');
  },

  requiresStructuredEvidenceGate(sourceSchemaId = '') {
    return ['wrong_question_paper', 'parent_report', 'talent_assessment', 'score_sheet', 'school_material'].includes(sourceSchemaId);
  },

  buildBlockedMaterialCta(decisionSource = {}, structuredEvidenceCapture = {}) {
    const missing = Array.isArray(structuredEvidenceCapture.missing) ? structuredEvidenceCapture.missing : [];
    return {
      title: '资料先补证据',
      line: missing.length
        ? `还差：${missing.slice(0, 2).join(' / ')}。补齐后才生成家长报告、轻练习或分享。`
        : '这类资料必须先补齐结构化证据，不能直接放行报告、游戏或分享。',
      route: '/pages/upload/upload?from=material_evidence_gate',
      actionRoute: '/pages/upload/upload?from=material_evidence_gate',
      gameRoute: '',
      sourceSchemaId: decisionSource.sourceSchemaId || '',
      blockedFields: ['report_cta', 'game_route', 'share_payload', 'talent_label', 'full_answer'],
      status: 'blocked_until_structured_evidence',
      structuredEvidenceMissing: missing
    };
  },

  buildGuardedAiReportDraft(uploadIntakePacket = {}, structuredEvidenceSignals = {}) {
    const adapter = importIntake.buildAiReportDraftAdapter
      ? importIntake.buildAiReportDraftAdapter(uploadIntakePacket, structuredEvidenceSignals)
      : (uploadIntakePacket.aiReportDraftAdapter || null);
    if (!adapter) return null;
    const sourceSchemaId = adapter.sourceSchemaId || (uploadIntakePacket.reportSeed && uploadIntakePacket.reportSeed.sourceSchemaId) || '';
    const blockedFields = Array.isArray(adapter.aiMustNotOwn) ? adapter.aiMustNotOwn : [];
    return Object.assign({}, adapter, {
      sourceSchemaId,
      visibleLine: sourceSchemaId === 'talent_assessment'
        ? 'AI 只把测评改写成学习方法候选；本地规则要求补真实错题、隔天回访和第 7 天小变式。'
        : 'AI 只生成家长摘要、追问和小讲堂候选；本地规则决定是否放行练习、分享和画像。',
      releaseGate: sourceSchemaId === 'talent_assessment'
        ? 'talent_method_candidate_until_real_wrong_question'
        : 'local_guarded_report_draft',
      blockedFields,
      safeForReport: !blockedFields.some((field) => ['full_answer', 'auto_grading', 'talent_label'].includes(field))
    });
  },

  requestAiMaterialAnalysis(uploadIntakePacket = {}, structuredEvidenceSignals = {}, options = {}) {
    const packet = uploadIntakePacket || {};
    const contract = importIntake.buildAiMaterialAnalysisContract
      ? importIntake.buildAiMaterialAnalysisContract(packet, structuredEvidenceSignals, {
        sourceText: options.sourceText || '',
        subject: structuredEvidenceSignals.subjectLabel || structuredEvidenceSignals.subjectKey || options.subject || '',
        confirmedScores: options.confirmedScores || null,
        parentObservation: options.parentObservation || ''
      })
      : null;
    const fallback = contract && contract.fallback
      ? contract.fallback
      : importIntake.buildAiMaterialAnalysisFallback(packet, structuredEvidenceSignals, 'local_fallback_no_contract');
    const payload = contract && contract.request ? contract.request.payload : null;
    if (!api.analyzeMiniappMaterial || !payload || !String(payload.source_text_excerpt || '').trim()) {
      return Promise.resolve(fallback);
    }
    return api.analyzeMiniappMaterial(payload).then((response) => {
      const raw = response && response.result ? response.result : response;
      return importIntake.sanitizeAiMaterialAnalysisResult
        ? importIntake.sanitizeAiMaterialAnalysisResult(raw || {}, {
          sourceSchemaId: payload.source_schema_id,
          subject: payload.subject,
          firstStep: structuredEvidenceSignals.firstStep || structuredEvidenceSignals.stuckFirstStep || '',
          wrongCause: structuredEvidenceSignals.wrongCause || structuredEvidenceSignals.wrongCauseGuess || ''
        })
        : (raw || fallback);
    }).catch(() => fallback);
  },

  buildTonightTaskCard(decisionSource = {}, reportState = {}, options = {}) {
    const sourceSchemaId = decisionSource.sourceSchemaId || 'parent_report';
    const reportDraft = reportState && reportState.reportDraft ? reportState.reportDraft : {};
    const evidence = options.structuredEvidenceSignals || {};
    const taskPlan = options.openMaicTaskPlan || {};
    const miniLesson = taskPlan.miniLesson || {};
    const topicCard = miniLesson.topicCard || taskPlan.topicCard || {};
    const miniLessonReport = taskPlan.miniLessonReport || {};
    const servicePathway = options.servicePathway || {};
    const firstStep = evidence.firstStep
      || evidence.stuckFirstStep
      || miniLessonReport.firstStep
      || (miniLesson.blackboard && miniLesson.blackboard.firstStep)
      || topicCard.microScript
      || topicCard.firstBoard
      || (reportDraft.tonightDecisionBrief && reportDraft.tonightDecisionBrief.nextAction)
      || '先让孩子说出第一步，不追完整答案。';
    const blackboardLine = miniLessonReport.blackboardLine
      || (miniLesson.blackboard && (miniLesson.blackboard.boardMove || miniLesson.blackboard.firstStep))
      || topicCard.firstBoard
      || '小黑板只画：题目问什么、已知什么、第一步做什么。';
    const commonMistake = miniLessonReport.misconceptionLine
      || miniLesson.misconception
      || evidence.wrongCause
      || evidence.wrongCauseGuess
      || '容易急着算完整答案，漏掉第一步的可检查证据。';
    const parentCheck = miniLessonReport.parentLine
      || miniLesson.parentLine
      || miniLesson.parentCheck
      || (reportDraft.familyDecisionMemo && reportDraft.familyDecisionMemo.parentMeetingScript && reportDraft.familyDecisionMemo.parentMeetingScript[0])
      || '你先说第一步，不用算完整题。';
    const tomorrowReview = miniLessonReport.nextDayReview
      || (miniLesson.nearTransfer && miniLesson.nearTransfer.prompt)
      || topicCard.nextDayCard
      || '明天只换一个相似材料，回访同一个第一步。';
    const nearTransfer = (miniLesson.nearTransfer && miniLesson.nearTransfer.prompt)
      || topicCard.nextDayCard
      || '换一个数字、图或材料，只复述第一步。';
    const blockedFields = Array.from(new Set(UPLOAD_DECISION_BLOCKED_FIELDS.concat(
      Array.isArray(options.blockedFields) ? options.blockedFields : [],
      Array.isArray(decisionSource.blockedFields) ? decisionSource.blockedFields : []
    )));
    const needsEvidence = sourceSchemaId === 'talent_assessment';
    return {
      id: 'tonight_task_card',
      title: needsEvidence ? '今晚只验证一种学习方法' : '今晚先跑通一张任务卡',
      status: needsEvidence ? 'method_candidate_only' : 'ready_for_first_step',
      sourceSchemaId,
      sourceSchemaLabel: decisionSource.sourceSchemaLabel || sourceSchemaId,
      subjectLabel: evidence.subjectLabel || evidence.subjectKey || decisionSource.subjectLabel || decisionSource.subjectKey || miniLessonReport.subject || topicCard.subject || '本次材料',
      taskType: evidence.taskType || decisionSource.taskType || topicCard.id || sourceSchemaId,
      conceptGap: miniLessonReport.conceptGap || miniLesson.conceptGap || topicCard.conceptGap || commonMistake,
      firstStep,
      blackboardLine,
      teacherLine: topicCard.microScript || '老师只讲一句：先把第一步说清楚。',
      classmateMistake: commonMistake,
      nearTransfer,
      parentCheck,
      tomorrowReview,
      actionRoute: options.actionRoute || servicePathway.nextRoute || '',
      gameRoute: needsEvidence ? '' : (options.gameRoute || ''),
      releaseGate: needsEvidence
        ? 'talent_method_candidate_requires_wrong_question_evidence'
        : (topicCard.localGate || miniLessonReport.topicLocalGate || 'child_can_say_first_step'),
      blockedFields,
      boundaryLine: needsEvidence
        ? '测评报告只作为方法候选，必须用真实错题和隔天回访验证。'
        : '小讲堂只补第一步，不给整题答案，不外发原题和孩子隐私。',
      safeShareFields: ['conceptGap', 'firstStep', 'blackboardLine', 'parentCheck', 'tomorrowReview']
    };
  },

  buildReportCta(decisionSource = {}, reportState = {}, options = {}) {
    const sourceSchemaId = decisionSource.sourceSchemaId || 'parent_report';
    const importedCards = Number(options.importedCards || 0);
    const cardId = options.cardId || '';
    const reportId = reportState && reportState.reportDraft ? reportState.reportDraft.id : '';
    const query = `reportId=${encodeURIComponent(reportId)}&sourceSchemaId=${encodeURIComponent(sourceSchemaId)}${cardId ? `&cardId=${encodeURIComponent(cardId)}` : ''}`;
    const reportDraft = reportState && reportState.reportDraft ? reportState.reportDraft : {};
    const personalizedPreview = reportState.personalizedParentReportPreview
      || reportDraft.personalizedParentReportPreview
      || null;
    const reportStandard = personalizedPreview && personalizedPreview.standard ? personalizedPreview.standard : null;
    const reportExportPolicy = personalizedPreview && personalizedPreview.exportPolicy
      ? personalizedPreview.exportPolicy
      : {
        htmlFirst: true,
        pdfAfterParentReview: true,
        printRule: 'HTML 预览优先；确认后用浏览器或服务端 print/export 转 PDF。',
        miniappLine: '小程序内展示摘要，完整 HTML/PDF 走 H5 WebView 或服务端临时文件。'
      };
    const uploadEvidenceSignals = options.structuredEvidenceSignals || {};
    const reportBehaviorSignals = reportDraft.behaviorSignals || {};
    const hasRealTaskReleaseEvidence = !!(
      uploadEvidenceSignals.firstStep
      || uploadEvidenceSignals.stuckFirstStep
      || uploadEvidenceSignals.wrongCause
      || uploadEvidenceSignals.wrongCauseGuess
      || cardId
      || importedCards > 0
    );
    const actionRoute = sourceSchemaId === 'talent_assessment'
      ? `/pages/upload/upload?from=talent_method_candidate&materialType=wrong_question_paper&sourceSchemaId=${encodeURIComponent(sourceSchemaId)}`
      : sourceSchemaId === 'wrong_question_paper' && hasRealTaskReleaseEvidence
      ? `/pages/review/review?from=upload_report_ready&${query}`
      : sourceSchemaId === 'wrong_question_paper'
        ? `/pages/upload/upload?from=material_evidence_gate&materialType=wrong_question_paper&${query}`
        : `/pages/tutor/tutor?from=upload_report_ready&${query}`;
    const sourceTextForMiniLesson = String(options.sourceText || reportDraft.sourceText || reportBehaviorSignals.sourceText || '').slice(0, 500);
    const guardedAiReportDraft = options.guardedAiReportDraft || null;
    const familyLearningDecisionReport = reportDraft.familyLearningDecisionReport || null;
    const familyLearningDecisionView = familyLearningDecisionReport ? {
      title: familyLearningDecisionReport.executiveSummary && familyLearningDecisionReport.executiveSummary.title
        ? familyLearningDecisionReport.executiveSummary.title
        : '家庭学习诊断与7天验证方案',
      oneLine: familyLearningDecisionReport.executiveSummary && familyLearningDecisionReport.executiveSummary.oneLine
        ? familyLearningDecisionReport.executiveSummary.oneLine
        : '先确认孩子卡住的位置，再做7天小闭环验证。',
      p0Line: familyLearningDecisionReport.p0Subject
        ? `优先验证：${familyLearningDecisionReport.p0Subject}`
        : '',
      anchorLine: familyLearningDecisionReport.anchorSubject
        ? `信心支点：${familyLearningDecisionReport.anchorSubject}`
        : '',
      qualityLine: familyLearningDecisionReport.qualityCheck
        ? `质量门：${familyLearningDecisionReport.qualityCheck.score}/100 · ${familyLearningDecisionReport.qualityCheck.status}`
        : '质量门：待评分',
      guardLine: familyLearningDecisionReport.inputGuard && familyLearningDecisionReport.inputGuard.requiresConfirmation
        ? '存在缺失或冲突字段，需家长/老师确认后再作正式结论。'
        : '事实字段已进入本地校验，报告不编造成绩、性别或年级。',
      tonightLine: familyLearningDecisionReport.parentTonightCard && familyLearningDecisionReport.parentTonightCard.canSay
        ? familyLearningDecisionReport.parentTonightCard.canSay[0]
        : '',
      dayOneLine: familyLearningDecisionReport.sevenDayPlan && familyLearningDecisionReport.sevenDayPlan[0]
        ? `Day 1：${familyLearningDecisionReport.sevenDayPlan[0].task}`
        : ''
    } : null;
    const miniLessonSubject = uploadEvidenceSignals.subjectLabel
      || uploadEvidenceSignals.subjectKey
      || decisionSource.subjectLabel
      || decisionSource.subjectKey
      || options.subject
      || reportBehaviorSignals.subject
      || decisionSource.sourceSchemaLabel
      || sourceSchemaId;
    const scoreSignalView = buildUploadScoreSignalView(reportState, reportDraft, decisionSource);
    const contentCoverageReceipt = buildUploadContentCoverageReceipt(decisionSource, uploadEvidenceSignals);
    const serverAiMaterialAnalysis = options.aiMaterialAnalysisResult || null;
    const aiMaterialAnalysisContractBase = importIntake.buildAiMaterialAnalysisContract
      ? importIntake.buildAiMaterialAnalysisContract(uploadEvidenceSignals.uploadIntakePacket || {
        intakeSourceSchema: { id: sourceSchemaId, label: decisionSource.sourceSchemaLabel || sourceSchemaId },
        reportSeed: { sourceSchemaId, sourceSchemaLabel: decisionSource.sourceSchemaLabel || sourceSchemaId }
      }, uploadEvidenceSignals, {
        sourceText: sourceTextForMiniLesson,
        subject: miniLessonSubject,
        confirmedScores: scoreSignalView.confirmedScores || null
      })
      : null;
    const aiMaterialAnalysisContract = serverAiMaterialAnalysis && aiMaterialAnalysisContractBase
      ? Object.assign({}, aiMaterialAnalysisContractBase, {
        fallback: serverAiMaterialAnalysis,
        serverAnalysisStatus: serverAiMaterialAnalysis.status || 'server_ai_analysis_ready'
      })
      : aiMaterialAnalysisContractBase;
    const aiMaterialSolutionView = buildUploadAiMaterialSolutionView(aiMaterialAnalysisContract, sourceSchemaId, {
      scoreSignalView,
      contentCoverageReceipt
    });
    const miniLessonFirstStep = uploadEvidenceSignals.firstStep
      || uploadEvidenceSignals.stuckFirstStep
      || reportBehaviorSignals.firstStep
      || (reportDraft.familyDecisionMemo && reportDraft.familyDecisionMemo.decisionCard && reportDraft.familyDecisionMemo.decisionCard.firstStep)
      || (reportDraft.tonightDecisionBrief && reportDraft.tonightDecisionBrief.nextAction)
      || '先让孩子说出第一步。';
    const miniLessonWrongCause = uploadEvidenceSignals.wrongCause
      || uploadEvidenceSignals.wrongCauseGuess
      || reportBehaviorSignals.wrongCause
      || (reportDraft.familyDecisionMemo && reportDraft.familyDecisionMemo.decisionCard && reportDraft.familyDecisionMemo.decisionCard.cause)
      || (decisionSource.sourceSchemaLabel || '资料还需要真实作业证据确认。');
    const miniLessonTaskType = uploadEvidenceSignals.taskType
      || decisionSource.taskType
      || uploadEvidenceSignals.questionType
      || reportBehaviorSignals.questionType
      || sourceSchemaId;
    const openMaicTaskPlan = openMaicInspiredPlan.buildOpenMaicInspiredTaskPlan({
      taskType: miniLessonTaskType,
      subject: miniLessonSubject,
      sourceText: sourceTextForMiniLesson,
      firstStep: miniLessonFirstStep,
      wrongCause: miniLessonWrongCause,
      pressureSignal: {
        taskType: miniLessonTaskType,
        firstStep: miniLessonFirstStep,
        wrongCause: miniLessonWrongCause,
        parentCheck: (reportDraft.familyDecisionMemo && reportDraft.familyDecisionMemo.parentMeetingScript && reportDraft.familyDecisionMemo.parentMeetingScript[0])
          || '你先说第一步，不用算完整题。',
        reviewMove: '明天遮住答案，只回访同一个第一步。'
      }
    });
    const openMaicDecisionBridge = openMaicInspiredPlan.buildOpenMaicInspiredDecisionBridge(openMaicTaskPlan, reportDraft, {
      nextStep: actionRoute
    }, {
      summary: sourceSchemaId === 'wrong_question_paper' ? '错题先进入错因复现，再放行轻练习。' : '资料先进入第一步回访，再放行报告。'
    });
    const safeRelayPayload = Object.assign({}, openMaicDecisionBridge.shareRelayPayload || {}, {
      from: 'upload',
      reportId,
      sourceSchemaId,
      cardId,
      returnRoute: actionRoute,
      blockedFields: Array.from(new Set(UPLOAD_DECISION_BLOCKED_FIELDS.concat(
        openMaicDecisionBridge.shareRelayPayload && Array.isArray(openMaicDecisionBridge.shareRelayPayload.blockedFields)
          ? openMaicDecisionBridge.shareRelayPayload.blockedFields
          : [],
        Array.isArray(decisionSource.blockedFields) ? decisionSource.blockedFields : []
      )))
    });
    const servicePathway = learningServicePathway.buildLearningServicePathway({
      sourceSchemaId,
      sourceText: sourceTextForMiniLesson,
      decisionSource,
      reportDraft,
      structuredEvidenceSignals: uploadEvidenceSignals,
      importedCards,
      cardId,
      parentConfirmed: !!(reportState.parentConfirmed || reportDraft.parentConfirmed)
    });
    const partnerWorkbench = partnerDeliveryWorkbench.buildPartnerDeliveryWorkbench({
      childProfile: reportState.childProfile || reportDraft.childProfile || {},
      parentConfirmed: !!(reportState.parentConfirmed || reportDraft.parentConfirmed),
      materials: [{
        id: cardId || reportId || sourceSchemaId,
        sourceSchemaId,
        title: decisionSource.sourceSchemaLabel || sourceSchemaId,
        structuredEvidenceSignals: uploadEvidenceSignals
      }],
      servicePathway,
      aiAnalysis: guardedAiReportDraft
    });
    const uploadedMaterialDecisionDossier = reportState.uploadedMaterialDecisionDossier
      || reportDraft.uploadedMaterialDecisionDossier
      || null;
    const hasGameReleaseEvidence = hasRealTaskReleaseEvidence;
    const servicePathwayAllowsGame = !!(
      servicePathway
      && Array.isArray(servicePathway.modeRecommendations)
      && servicePathway.modeRecommendations.some((item) => item && item.id === 'game_recall')
    );
    const gameRoute = sourceSchemaId !== 'talent_assessment' && hasGameReleaseEvidence && servicePathwayAllowsGame
      ? `/pages/arcade/arcade?from=upload_report_ready&${query}`
      : '';
    const tonightTaskCard = this.buildTonightTaskCard(decisionSource, reportState, {
      structuredEvidenceSignals: uploadEvidenceSignals,
      openMaicTaskPlan,
      servicePathway,
      actionRoute,
      gameRoute,
      blockedFields: safeRelayPayload.blockedFields
    });
    const dailyExecutionSeed = buildUploadDailyExecutionSeed({
      sourceSchemaId,
      reportId,
      actionRoute,
      gameRoute,
      aiMaterialSolutionView,
      scoreSignalView,
      contentCoverageReceipt,
      tonightTaskCard
    });
    const partnerDeliveryLedgerView = buildUploadPartnerLedgerView(
      servicePathway && servicePathway.partnerServiceDeliveryLedger
    );
    const validationPlanView = buildUploadValidationPlanView(
      servicePathway && servicePathway.validationPlan,
      sourceSchemaId
    );
    const productTierView = buildUploadProductTierView(
      servicePathway && servicePathway.productTiers
    );
    const modeRecommendationView = buildUploadModeRecommendationView(
      servicePathway && servicePathway.modeRecommendations
    );
    const modeChoiceProtocolView = buildUploadModeChoiceProtocolView(
      servicePathway && servicePathway.modeChoiceProtocol
    );
    const aiLocalDeliveryView = buildUploadAiLocalDeliveryView(
      servicePathway && servicePathway.aiLocalDeliverySplit
    );
    const publicK12BorrowView = buildUploadPublicK12BorrowView(
      servicePathway && servicePathway.publicK12BorrowPlaybook
    );
    const quickAssessmentBridgeView = buildUploadQuickAssessmentBridgeView(
      servicePathway && servicePathway.quickAssessmentBridge
    );
    const postPilotRetentionView = buildUploadPostPilotRetentionView(
      servicePathway && servicePathway.postPilotRetentionLoop
    );
    const personalizedClosureView = buildUploadPersonalizedClosureView(
      servicePathway && servicePathway.personalizedClosureBridge
    );
    const serviceHandoffPack = buildUploadServiceHandoffPack({
      sourceSchemaId,
      servicePathway,
      tonightTaskCard,
      validationPlanView,
      productTierView,
      partnerWorkbench,
      hasRealTaskEvidence: hasRealTaskReleaseEvidence,
      parentConfirmed: !!(reportState.parentConfirmed || reportDraft.parentConfirmed)
    });
    return {
      title: sourceSchemaId === 'talent_assessment'
        ? '方法候选已入证据账本'
        : sourceSchemaId === 'wrong_question_paper'
          ? '错题已进入家长报告'
          : '资料已进入家长报告',
      line: sourceSchemaId === 'talent_assessment'
        ? '这里只放行学习方法候选，不生成复习卡、不贴天赋标签；下一步用真实错题和回访验证。'
        : sourceSchemaId === 'wrong_question_paper'
          ? `已生成报告证据${importedCards ? `，并整理 ${importedCards} 张错题卡` : ''}；先看家长决策，再去修那一张卡。`
          : '已生成资料证据卷宗；先看本次材料怎么用，再决定是否进入点拨或回访。',
      route: `/pages/profile/profile?from=upload_report_ready&${query}`,
      actionRoute,
      gameRoute,
      actionLabel: sourceSchemaId === 'talent_assessment'
        ? '补真实错题验证'
        : sourceSchemaId === 'wrong_question_paper' ? '去修这批错题' : '去问第一步',
      aiLocalBoundary: {
        localCodeOwns: ['source_type_classification', 'release_gate', 'next_evidence_route', 'portrait_confidence_weight', 'share_fields'],
        aiBetterFor: ['parent_summary_copy', 'child_friendly_prompt', 'method_explanation', 'socratic_question_wording'],
        aiMustNotOwn: ['talent_label', 'auto_grading', 'ocr_claim', 'full_answer', 'reward_release'],
        releaseRule: sourceSchemaId === 'talent_assessment'
          ? 'talent_assessment_requires_real_wrong_question_before_practice'
          : 'material_report_requires_structured_evidence_before_release'
      },
      guardedAiReportDraft,
      aiMaterialAnalysisContract,
      tonightTaskCard,
      servicePathway,
      partnerDeliveryLedgerView,
      validationPlanView,
      productTierView,
      modeRecommendationView,
      modeChoiceProtocolView,
      aiLocalDeliveryView,
      publicK12BorrowView,
      quickAssessmentBridgeView,
      aiMaterialSolutionView,
      scoreSignalView,
      contentCoverageReceipt,
      dailyExecutionSeed,
      postPilotRetentionView,
      personalizedClosureView,
      serviceHandoffPack,
      familyLearningDecisionView,
      personalizedParentReportPreviewMeta: personalizedPreview ? {
        id: personalizedPreview.id,
        title: personalizedPreview.title,
        format: personalizedPreview.format,
        htmlLength: personalizedPreview.htmlLength,
        standardId: personalizedPreview.standardId,
        standardVersion: personalizedPreview.standardVersion,
        printRule: personalizedPreview.printRule,
        miniappExportLine: personalizedPreview.miniappExportLine,
        parentTopLine: personalizedPreview.parentTopLine
      } : null,
      reportStandard,
      reportExportPolicy,
      reportExportLine: reportExportPolicy.miniappLine || reportExportPolicy.printRule || 'HTML 预览确认后再导出 PDF。',
      reportPreviewRoute: `/pages/profile/profile?from=upload_report_preview&panel=assessment&${query}`,
      partnerDeliveryWorkbench: partnerWorkbench,
      uploadedMaterialDecisionDossier,
      needsParentConfirmation: servicePathway && servicePathway.partnerServiceDeliveryLedger
        ? servicePathway.partnerServiceDeliveryLedger.status === 'needs_parent_confirmation'
        : false,
      parentConfirmation: (reportState.parentConfirmation || reportDraft.parentConfirmation || null),
      sourceSchemaId,
      reportId,
      aiLocalReleaseLine: uploadReleaseRuleLine(sourceSchemaId === 'talent_assessment'
        ? 'talent_assessment_requires_real_wrong_question_before_practice'
        : 'material_report_requires_structured_evidence_before_release'),
      safeRelayReturnLine: uploadReturnRouteLine(actionRoute),
      flowTraceId: `upload_report:${reportId || sourceSchemaId}:${cardId || 'no_card'}`,
      dailyExecutionSeedSyncPayload: dailyExecutionSeed.syncPayload,
      cardId,
      importedCardIds: Array.isArray(options.importedCardIds) ? options.importedCardIds : [],
      blockedFields: safeRelayPayload.blockedFields,
      openMaicTaskPlanAudit: openMaicInspiredPlan.evaluateOpenMaicInspiredTaskPlan(openMaicTaskPlan),
      openMaicDecisionBridge,
      miniLessonSourceEvidence: {
        sourceSchemaId,
        subjectKey: uploadEvidenceSignals.subjectKey || decisionSource.subjectKey || '',
        subjectLabel: uploadEvidenceSignals.subjectLabel || decisionSource.subjectLabel || '',
        taskType: miniLessonTaskType,
        sourceTextReady: !!sourceTextForMiniLesson,
        structuredEvidenceReady: !!(uploadEvidenceSignals.firstStep || uploadEvidenceSignals.wrongCause || uploadEvidenceSignals.questionType),
        topicCardId: openMaicTaskPlan.miniLesson && openMaicTaskPlan.miniLesson.topicCard ? openMaicTaskPlan.miniLesson.topicCard.id : '',
        topicLocalGate: openMaicTaskPlan.miniLesson && openMaicTaskPlan.miniLesson.topicCard ? openMaicTaskPlan.miniLesson.topicCard.localGate : '',
        activeRecallLadderCount: openMaicDecisionBridge.gameReturnEvidence && Array.isArray(openMaicDecisionBridge.gameReturnEvidence.activeRecallRevisitLadder)
          ? openMaicDecisionBridge.gameReturnEvidence.activeRecallRevisitLadder.length
          : 0
      },
      safeRelayPayload,
      returnRoute: actionRoute
    };
  },

  saveReportHandoff(cta = {}) {
    if (!storage.set || !cta) return;
    const now = Date.now ? Date.now() : new Date().getTime();
    storage.set('upload.report.handoff.v1', Object.assign({}, cta, {
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      consumedAt: '',
      status: 'ready'
    }));
  },

  persistReportCtaToReportState(reportState = {}, cta = {}) {
    if (!storage.saveLearningReportState || !reportState || !cta) return reportState;
    const uploadedMaterialDecisionDossier = this.attachServicePathwayToUploadedDossier(
      cta.uploadedMaterialDecisionDossier || reportState.uploadedMaterialDecisionDossier || null,
      cta.servicePathway || reportState.servicePathway || null
    );
    const nextState = Object.assign({}, reportState, {
      openMaicDecisionBridge: cta.openMaicDecisionBridge || null,
      openMaicInspiredDecisionBridge: cta.openMaicDecisionBridge || null,
      miniLessonSourceEvidence: cta.miniLessonSourceEvidence || null,
      guardedAiReportDraft: cta.guardedAiReportDraft || null,
      aiMaterialAnalysisContract: cta.aiMaterialAnalysisContract || null,
      aiMaterialSolutionView: cta.aiMaterialSolutionView || null,
      scoreSignalView: cta.scoreSignalView || null,
      contentCoverageReceipt: cta.contentCoverageReceipt || null,
      dailyExecutionSeed: cta.dailyExecutionSeed || null,
      personalizedClosureView: cta.personalizedClosureView || null,
      familyLearningDecisionView: cta.familyLearningDecisionView || null,
      personalizedParentReportPreviewMeta: cta.personalizedParentReportPreviewMeta || null,
      reportStandard: cta.reportStandard || null,
      reportExportPolicy: cta.reportExportPolicy || null,
      reportExportLine: cta.reportExportLine || '',
      servicePathway: cta.servicePathway || null,
      partnerDeliveryWorkbench: cta.partnerDeliveryWorkbench || null,
      serviceHandoffPack: cta.serviceHandoffPack || null,
      tonightTaskCard: cta.tonightTaskCard || null,
      uploadedMaterialDecisionDossier,
      uploadReportHandoff: cta,
      flowTraceId: cta.flowTraceId || `upload_report:${cta.reportId || Date.now()}`
    });
    if (nextState.reportDraft) {
      nextState.reportDraft = Object.assign({}, nextState.reportDraft, {
        openMaicDecisionBridge: cta.openMaicDecisionBridge || null,
        openMaicInspiredDecisionBridge: cta.openMaicDecisionBridge || null,
        miniLessonSourceEvidence: cta.miniLessonSourceEvidence || null,
        guardedAiReportDraft: cta.guardedAiReportDraft || null,
        aiMaterialAnalysisContract: cta.aiMaterialAnalysisContract || null,
        aiMaterialSolutionView: cta.aiMaterialSolutionView || null,
        scoreSignalView: cta.scoreSignalView || null,
        contentCoverageReceipt: cta.contentCoverageReceipt || null,
        dailyExecutionSeed: cta.dailyExecutionSeed || null,
        personalizedClosureView: cta.personalizedClosureView || null,
        familyLearningDecisionView: cta.familyLearningDecisionView || null,
        personalizedParentReportPreviewMeta: cta.personalizedParentReportPreviewMeta || null,
        reportStandard: cta.reportStandard || null,
        reportExportPolicy: cta.reportExportPolicy || null,
        reportExportLine: cta.reportExportLine || '',
        servicePathway: cta.servicePathway || null,
        partnerDeliveryWorkbench: cta.partnerDeliveryWorkbench || null,
        serviceHandoffPack: cta.serviceHandoffPack || null,
        tonightTaskCard: cta.tonightTaskCard || null,
        uploadedMaterialDecisionDossier,
        uploadReportHandoff: cta,
        flowTraceId: nextState.flowTraceId
      });
    }
    storage.saveLearningReportState(nextState, { skipBuild: true });
    return nextState;
  },

  markCtaParentConfirmed(cta = {}, confirmedAt = '') {
    const servicePathway = cta.servicePathway || {};
    const ledger = servicePathway.partnerServiceDeliveryLedger || null;
    const nextLedger = ledger ? Object.assign({}, ledger, {
      status: ledger.status === 'pre_sale_needs_real_task_evidence'
        ? ledger.status
        : 'deliverable_after_parent_confirmation',
      releaseGate: ledger.status === 'pre_sale_needs_real_task_evidence'
        ? ledger.releaseGate
        : 'parent_confirmed_private_fields_removed',
      packageCards: Array.isArray(ledger.packageCards)
        ? ledger.packageCards.map((item) => item && item.id === 'seven_day_execution'
          ? Object.assign({}, item, {
            entryGate: 'real_task_evidence_ready_and_parent_confirmed'
          })
          : item)
        : []
    }) : null;
    const nextPathway = servicePathway && servicePathway.id ? Object.assign({}, servicePathway, {
      signals: Object.assign({}, servicePathway.signals || {}, { parentConfirmed: true }),
      modeChoiceProtocol: servicePathway.modeChoiceProtocol ? Object.assign({}, servicePathway.modeChoiceProtocol, {
        releaseGate: 'mode_choice_parent_confirmed'
      }) : servicePathway.modeChoiceProtocol,
      partnerServiceDeliveryLedger: nextLedger || servicePathway.partnerServiceDeliveryLedger
    }) : servicePathway;
    return Object.assign({}, cta, {
      servicePathway: nextPathway,
      needsParentConfirmation: false,
      parentConfirmation: {
        status: 'confirmed',
        confirmedAt,
        evidenceLine: '家长已确认：只按本页可见字段交付，不外发原题、答案、分数、排名、孩子姓名或联系方式。'
      }
    });
  },

  confirmReportParentConsent() {
    const cta = this.data.lastReportCta || {};
    const confirmedAt = new Date().toISOString();
    const nextCta = this.markCtaParentConfirmed(cta, confirmedAt);
    const reportState = storage.loadLearningReportState ? storage.loadLearningReportState() : {};
    const nextState = Object.assign({}, reportState, {
      parentConfirmed: true,
      parentConfirmation: nextCta.parentConfirmation,
      servicePathway: nextCta.servicePathway || reportState.servicePathway || null,
      partnerDeliveryWorkbench: nextCta.partnerDeliveryWorkbench || reportState.partnerDeliveryWorkbench || null,
      uploadReportHandoff: nextCta,
      flowTraceId: nextCta.flowTraceId || reportState.flowTraceId || `upload_parent_confirm:${confirmedAt}`
    });
    if (nextState.reportDraft) {
      nextState.reportDraft = Object.assign({}, nextState.reportDraft, {
        parentConfirmed: true,
        parentConfirmation: nextCta.parentConfirmation,
        servicePathway: nextCta.servicePathway || null,
        uploadReportHandoff: nextCta
      });
    }
    if (storage.saveLearningReportState) storage.saveLearningReportState(nextState, { skipBuild: true });
    this.setData({ lastReportCta: nextCta });
    wx.showToast({ title: '已确认交付范围', icon: 'none' });
  },

  attachServicePathwayToUploadedDossier(dossier = null, servicePathway = null) {
    if (!dossier || !servicePathway || !servicePathway.id) return dossier;
    return Object.assign({}, dossier, {
      servicePathwaySummary: Object.assign({}, dossier.servicePathwaySummary || {}, {
        status: servicePathway.status || '',
        primaryMode: servicePathway.primaryMode || null,
        primaryTier: servicePathway.primaryTier || null,
        releaseGate: servicePathway.safetyBoundary ? servicePathway.safetyBoundary.releaseGate : '',
        validationPlan: Array.isArray(servicePathway.validationPlan) ? servicePathway.validationPlan.slice(0, 7) : [],
        partnerHandoffPolicy: servicePathway.partnerHandoffPolicy || null,
        blockedClaims: servicePathway.safetyBoundary && Array.isArray(servicePathway.safetyBoundary.blocked)
          ? servicePathway.safetyBoundary.blocked.slice()
          : []
      })
    });
  },

  afterPrioritySaved(text, state, plan, mode) {
    let wrongbook = this.previewWrongQuestionsToReview(text);
    let latestReportCta = null;
    if (storage.buildLearningReportFromInput && storage.saveLearningReportState) {
      const profile = storage.loadProfile ? storage.loadProfile() : {};
      const uploadIntakePacket = this.data.uploadIntakePacket
        || importIntake.buildUploadIntakePacket(text, this.data.imagePaths, this.data.materialType);
      const reportSeed = (uploadIntakePacket && uploadIntakePacket.reportSeed) || {};
      const decisionSource = this.buildDecisionSource(uploadIntakePacket, text, wrongbook, reportSeed);
      const structuredEvidenceCapture = this.buildStructuredEvidenceCapture(
        uploadIntakePacket,
        text,
        this.data.structuredEvidenceCapture && this.data.structuredEvidenceCapture.values
      );
      const evidenceText = this.mergeStructuredEvidenceText(text, structuredEvidenceCapture);
      const structuredEvidenceSignals = this.buildStructuredEvidenceSignals(
        uploadIntakePacket,
        evidenceText,
        structuredEvidenceCapture.values
      );
      if (this.requiresStructuredEvidenceGate(decisionSource.sourceSchemaId) && !structuredEvidenceCapture.ready) {
        latestReportCta = this.buildBlockedMaterialCta(decisionSource, structuredEvidenceCapture);
        this.setData({
          uploadIntakePacket,
          structuredEvidenceCapture,
          lastDecisionSource: decisionSource,
          lastReportCta: latestReportCta
        });
        wx.showToast({ title: '已分类，报告待补证据', icon: 'none' });
        return;
      }
      wrongbook = this.importWrongQuestionsToReview(text, state, plan);
      this.saveFocusFromUploadText(text, state, plan);
      const guardedAiReportDraft = this.buildGuardedAiReportDraft(uploadIntakePacket, structuredEvidenceSignals);
      let reportState = storage.buildLearningReportFromInput({
        mode: wrongbook.imported ? 'full' : 'fast',
        sourceText: evidenceText,
        reportSources: [{
          type: decisionSource.sourceSchemaId,
          label: decisionSource.sourceSchemaLabel,
          text: evidenceText,
          confidence: decisionSource.confidence,
          status: reportSeed.status || '待家长确认',
          sourceSchemaId: decisionSource.sourceSchemaId,
          sourceSchemaLabel: decisionSource.sourceSchemaLabel,
          subjectKey: structuredEvidenceSignals.subjectKey || decisionSource.subjectKey || '',
          subjectLabel: structuredEvidenceSignals.subjectLabel || decisionSource.subjectLabel || '',
          taskType: structuredEvidenceSignals.taskType || decisionSource.taskType || '',
          inputChannel: decisionSource.inputChannel,
          imageCount: decisionSource.imageCount,
          releaseScope: decisionSource.releaseScope,
          portraitConfidenceWeight: decisionSource.portraitConfidenceWeight,
          evidenceGap: decisionSource.evidenceGap,
          requiredNextEvidence: decisionSource.requiredNextEvidence,
          nextEvidenceUnlockPlan: decisionSource.nextEvidenceUnlockPlan,
          methodValidationChallengeChain: decisionSource.methodValidationChallengeChain,
          sourceReadinessBoard: decisionSource.sourceReadinessBoard,
          structuredCapture: structuredEvidenceSignals.structuredCapture,
          blockedFields: decisionSource.blockedFields
        }],
        decisionSource,
        profileBasics: {
          grade: profile.grade || state.grade || '',
          age: '',
          gender: '',
          region: '',
          schoolType: ''
        },
        behaviorSignals: {
          studyMinutes: Number(this.data.minutes || 0) || '',
          homeworkMinutes: Number(this.data.minutes || 0) || '',
          wrongCause: structuredEvidenceSignals.wrongCause || reportSeed.wrongCause || (wrongbook.imported ? 'wrong_question_imported_needs_first_step_check' : ''),
          firstStep: structuredEvidenceSignals.firstStep || reportSeed.firstStep || '',
          childOriginalThought: structuredEvidenceSignals.childOriginalThought || '',
          questionType: structuredEvidenceSignals.questionType || '',
          subjectKey: structuredEvidenceSignals.subjectKey || decisionSource.subjectKey || '',
          subjectLabel: structuredEvidenceSignals.subjectLabel || decisionSource.subjectLabel || '',
          taskType: structuredEvidenceSignals.taskType || decisionSource.taskType || '',
          structuredCapture: structuredEvidenceSignals.structuredCapture,
          parentQuestion: '今晚只问：这题第一步你先看哪里？',
          nextDayRevisit: '明天遮住答案，只回看一张最不稳的卡',
          sourceSchemaId: decisionSource.sourceSchemaId,
          requiredNextEvidence: decisionSource.requiredNextEvidence,
          structuredEvidenceCapture,
          structuredEvidenceReady: structuredEvidenceCapture.ready,
          structuredEvidenceMissing: structuredEvidenceCapture.missing,
          structuredCapturePrompts: uploadIntakePacket && Array.isArray(uploadIntakePacket.structuredCapturePrompts)
            ? uploadIntakePacket.structuredCapturePrompts
            : [],
          photoEvidencePolicy: uploadIntakePacket && uploadIntakePacket.photoEvidencePolicy
            ? uploadIntakePacket.photoEvidencePolicy
            : null,
          guardedAiReportDraft
        },
        emotionSignals: {},
        interestSignals: {},
        assessmentAnswers: []
      });
      storage.saveLearningReportState(reportState, { skipBuild: true });
      latestReportCta = this.buildReportCta(decisionSource, reportState, {
        importedCards: wrongbook.imported,
        cardId: wrongbook.firstCardId || '',
        importedCardIds: wrongbook.importedCardIds || [],
        sourceText: evidenceText,
        structuredEvidenceSignals,
        guardedAiReportDraft,
        subject: structuredEvidenceSignals.subjectLabel || decisionSource.subjectLabel || profile.subject || state.subject || ''
      });
      reportState = this.persistReportCtaToReportState(reportState, latestReportCta);
      this.saveReportHandoff(latestReportCta);
    }
    this.setData({ lastReportCta: latestReportCta });
    const toastTitle = wrongbook.imported
      ? `已整理 ${wrongbook.imported} 张错题卡`
      : (mode === 'server' ? '已完成三分类' : '本地完成分类');
    wx.showToast({ title: toastTitle, icon: 'success' });
    setTimeout(() => {
      navigation.navigateLearningRoute((latestReportCta && latestReportCta.route) || '/pages/profile/profile?from=upload');
    }, 500);
  },

  updateMaterialPreview(text, type) {
    const materialIntakePacket = importIntake.buildUploadIntakePacket(String(text || '').trim(), this.data.imagePaths, type);
    const structuredEvidenceCapture = this.buildStructuredEvidenceCapture(
      materialIntakePacket,
      text,
      this.data.structuredEvidenceCapture && this.data.structuredEvidenceCapture.values
    );
    this.setData({
      materialPreview: this.buildMaterialPreview(text, type),
      materialIntakePacket,
      structuredEvidenceCapture
    });
  },

  chooseImage() {
    privacy.requirePrivacy('照片本地留存').then(() => {
      const onSuccess = (res) => {
        const files = res.tempFiles || (res.tempFilePaths || []).map((path) => ({ tempFilePath: path }));
        this.setData({
          imagePaths: files.map((item) => item.tempFilePath).filter(Boolean).slice(0, 4)
        });
        this.updatePreview(this.data.homeworkText, this.data.minutes);
      };
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 4,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          success: onSuccess
        });
      } else {
        wx.chooseImage({
          count: 4,
          sourceType: ['album', 'camera'],
          success: onSuccess
        });
      }
    }).catch(() => {});
  },

  chooseMaterialFile() {
    if (!wx.chooseMessageFile) {
      wx.showToast({ title: '当前微信版本不支持选文件，请先粘贴文字', icon: 'none' });
      return;
    }
    wx.chooseMessageFile({
      count: 3,
      type: 'file',
      extension: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
      success: (res) => {
        const files = (res.tempFiles || []).map((item) => ({
          name: item.name || 'material_file',
          path: item.path || item.tempFilePath || '',
          size: item.size || 0
        })).filter((item) => item.path || item.name).slice(0, 3);
        this.setData({
          materialFiles: files,
          materialType: 'pdf_excerpt',
          showMaterialPanel: true
        });
        this.updateMaterialPreview(this.data.materialText, 'pdf_excerpt');
        wx.showToast({ title: '文件已留档，请粘贴提取文字', icon: 'none' });
      }
    });
  },

  onInput(event) {
    const homeworkText = event.detail.value;
    this.setData({ homeworkText });
    this.updatePreview(homeworkText, this.data.minutes);
  },

  onMaterialInput(event) {
    const materialText = event.detail.value;
    this.setData({ materialText });
    this.updateMaterialPreview(materialText, this.data.materialType);
  },

  onStructuredEvidenceInput(event) {
    const fieldId = event.currentTarget.dataset.fieldId || '';
    const value = event.detail.value;
    const current = this.data.structuredEvidenceCapture || this.buildStructuredEvidenceCapture(this.data.materialIntakePacket || {}, this.data.materialText || '');
    const values = Object.assign({}, current.values || {}, { [fieldId]: value });
    this.setData({
      structuredEvidenceCapture: this.buildStructuredEvidenceCapture(
        this.data.materialIntakePacket || importIntake.buildUploadIntakePacket(this.data.materialText || '', this.data.imagePaths, this.data.materialType),
        this.data.materialText || '',
        values
      )
    });
  },

  setMaterialType(event) {
    const materialType = event.currentTarget.dataset.type || 'class_notes';
    this.setData({ materialType });
    this.updateMaterialPreview(this.data.materialText, materialType);
  },

  openMaterialReportPanel(event) {
    const materialType = normalizeMaterialType(event.currentTarget.dataset.type || 'parent_report');
    const deck = buildUploadEntryDeck('material');
    this.setData({
      uploadEntryMode: 'material',
      uploadEntryDeck: deck,
      homeworkPlaceholder: deck.placeholder,
      showMaterialPanel: true,
      materialType
    });
    this.updateMaterialPreview(this.data.materialText, materialType);
  },

  openQuickAssessment() {
    navigation.navigateLearningRoute('/pages/profile/profile?from=upload_no_assessment&panel=report&quick_assessment=1');
  },

  async importMaterialPack() {
    const text = String(this.data.materialText || '').trim();
    if (!text) {
      wx.showToast({ title: '先粘贴学习材料', icon: 'none' });
      return;
    }
    const uploadIntakePacket = importIntake.buildUploadIntakePacket(text, this.data.imagePaths, this.data.materialType);
    const structuredEvidenceCapture = this.buildStructuredEvidenceCapture(
      uploadIntakePacket,
      text,
      this.data.structuredEvidenceCapture && this.data.structuredEvidenceCapture.values
    );
    const evidenceText = this.mergeStructuredEvidenceText(text, structuredEvidenceCapture);
    const decisionSource = this.buildDecisionSource(uploadIntakePacket, text, { imported: false }, (uploadIntakePacket && uploadIntakePacket.reportSeed) || {});
    const structuredEvidenceSignals = this.buildStructuredEvidenceSignals(uploadIntakePacket, evidenceText, structuredEvidenceCapture.values);
    if (this.requiresStructuredEvidenceGate(decisionSource.sourceSchemaId) && !structuredEvidenceCapture.ready) {
      const blockedCta = this.buildBlockedMaterialCta(decisionSource, structuredEvidenceCapture);
      this.setData({
        uploadIntakePacket,
        materialIntakePacket: uploadIntakePacket,
        structuredEvidenceCapture,
        lastDecisionSource: decisionSource,
        lastReportCta: blockedCta
      });
      wx.showToast({ title: '先补证据再放行', icon: 'none' });
      this.updateMaterialPreview(text, this.data.materialType);
      return;
    }
    const profile = storage.loadProfile();
    const shouldImportCards = !['talent_assessment', 'score_sheet'].includes(decisionSource.sourceSchemaId);
    let latestReportCta = null;
    let reportState = null;
    let aiMaterialAnalysisResult = null;
    if (storage.buildLearningReportFromInput && storage.saveLearningReportState) {
      aiMaterialAnalysisResult = await this.requestAiMaterialAnalysis(uploadIntakePacket, structuredEvidenceSignals, {
        sourceText: evidenceText,
        subject: structuredEvidenceSignals.subjectLabel || decisionSource.subjectLabel || profile.subject || '',
        confirmedScores: null,
        parentObservation: decisionSource.sourceSchemaId === 'parent_report' ? evidenceText : ''
      });
      reportState = storage.buildLearningReportFromInput({
        mode: decisionSource.sourceSchemaId === 'wrong_question_paper' ? 'full' : 'standard',
        sourceText: evidenceText,
        reportSources: [{
          type: decisionSource.sourceSchemaId,
          label: decisionSource.sourceSchemaLabel,
          text: evidenceText,
          confidence: decisionSource.confidence,
          status: '待家长确认',
          sourceSchemaId: decisionSource.sourceSchemaId,
          sourceSchemaLabel: decisionSource.sourceSchemaLabel,
          subjectKey: structuredEvidenceSignals.subjectKey || decisionSource.subjectKey || '',
          subjectLabel: structuredEvidenceSignals.subjectLabel || decisionSource.subjectLabel || '',
          taskType: structuredEvidenceSignals.taskType || decisionSource.taskType || '',
          inputChannel: decisionSource.inputChannel,
          imageCount: decisionSource.imageCount,
          releaseScope: decisionSource.releaseScope,
          portraitConfidenceWeight: decisionSource.portraitConfidenceWeight,
          evidenceGap: decisionSource.evidenceGap,
          requiredNextEvidence: decisionSource.requiredNextEvidence,
          nextEvidenceUnlockPlan: decisionSource.nextEvidenceUnlockPlan,
          methodValidationChallengeChain: decisionSource.methodValidationChallengeChain,
          sourceReadinessBoard: decisionSource.sourceReadinessBoard,
          structuredCapture: structuredEvidenceSignals.structuredCapture,
          blockedFields: decisionSource.blockedFields
        }],
        decisionSource,
        behaviorSignals: Object.assign({
          parentQuestion: '今晚只问：这题第一步你先看哪里？',
          nextDayRevisit: '明天遮住答案，只回访同一第一步。',
          sourceSchemaId: decisionSource.sourceSchemaId,
          requiredNextEvidence: decisionSource.requiredNextEvidence
        }, structuredEvidenceSignals, {
          structuredEvidenceCapture,
          structuredEvidenceReady: structuredEvidenceCapture.ready,
          structuredEvidenceMissing: structuredEvidenceCapture.missing,
          guardedAiReportDraft: this.buildGuardedAiReportDraft(uploadIntakePacket, structuredEvidenceSignals),
          aiMaterialAnalysisResult
        })
      });
      storage.saveLearningReportState(reportState, { skipBuild: true });
    }
    const result = shouldImportCards
      ? reviewCards.importTextToDeck(text, {
        subject: structuredEvidenceSignals.subjectLabel || decisionSource.subjectLabel || profile.subject || '',
        taskType: structuredEvidenceSignals.taskType || decisionSource.taskType || '',
        weakPoint: this.data.materialType,
        calibrationKey: `material:${this.data.materialType}`,
        source: `material_${this.data.materialType}:${decisionSource.sourceSchemaId}`,
        sourceSchemaId: decisionSource.sourceSchemaId,
        reportId: (reportState && reportState.id) || decisionSource.reportId || '',
        reportSourceId: decisionSource.sourceSchemaId,
        uploadMaterialType: this.data.materialType,
        releaseScope: decisionSource.releaseScope,
        requiredNextEvidence: decisionSource.requiredNextEvidence
      })
      : { imported: 0, skipped: 0, methodCandidateOnly: true };
    if (reportState) {
      latestReportCta = this.buildReportCta(decisionSource, reportState, {
        importedCards: result.imported,
        cardId: result.firstCardId || '',
        importedCardIds: result.importedCardIds || [],
        sourceText: evidenceText,
        structuredEvidenceSignals,
        guardedAiReportDraft: this.buildGuardedAiReportDraft(uploadIntakePacket, structuredEvidenceSignals),
        aiMaterialAnalysisResult,
        subject: structuredEvidenceSignals.subjectLabel || decisionSource.subjectLabel || profile.subject || ''
      });
      reportState = this.persistReportCtaToReportState(reportState, latestReportCta);
      this.saveReportHandoff(latestReportCta);
    }
    this.setData({
      uploadIntakePacket,
      materialIntakePacket: uploadIntakePacket,
      structuredEvidenceCapture,
      lastDecisionSource: decisionSource,
      lastReportCta: latestReportCta
    });
    wx.showToast({
      title: shouldImportCards
        ? (result.imported ? `已导入 ${result.imported} 张` : '已在复习库中')
        : '已进入报告候选',
      icon: 'success'
    });
    this.updateMaterialPreview(text, this.data.materialType);
    setTimeout(() => {
      navigation.navigateLearningRoute((latestReportCta && latestReportCta.route) || '/pages/profile/profile?from=upload_material_ready');
    }, 500);
  },

  onMinutes(event) {
    const minutes = event.detail.value;
    this.setData({ minutes });
    this.updatePreview(this.data.homeworkText, minutes);
  },

  adjustMinutes(event) {
    const delta = Number(event.currentTarget.dataset.delta || 0);
    const minutes = Math.max(10, Math.min(120, Number(this.data.minutes || 35) + delta));
    this.setData({ minutes });
    this.updatePreview(this.data.homeworkText, minutes);
  },

  useQuickChip(event) {
    const index = Number(event.currentTarget.dataset.index);
    const item = this.data.quickChips[index];
    if (!item) return;
    const current = String(this.data.homeworkText || '').trim();
    const homeworkText = current ? `${current}\n${item.text}` : item.text;
    this.setData({ homeworkText });
    this.updatePreview(homeworkText, this.data.minutes);
  },

  submit() {
    if (this.data.submitting) return;
    const text = String(this.data.homeworkText || '').trim();
    if (!text) {
      wx.showToast({ title: '先填作业清单', icon: 'none' });
      return;
    }
    const current = storage.loadState();
    const uploadIntakePacket = importIntake.buildUploadIntakePacket(text, this.data.imagePaths, this.data.materialType);
    const payload = {
      source: 'mini-upload',
      grade: current.grade,
      subject: current.subject,
      score: current.score,
      totalScore: current.total_score,
      minutes: Number(this.data.minutes),
      examText: (current.weak_points || []).map((item) => `${item.name} ${item.reason || ''}`).join('\n'),
      homeworkText: text
    };

    this.setData({ submitting: true });
    wx.showLoading({ title: '分类中' });

    api.buildPriority(payload).then((state) => {
      const nextState = Object.assign({}, current, state, {
        source: 'mini-upload-server',
        homework_text: text,
        image_count: this.data.imagePaths.length,
        upload_intake_packet: uploadIntakePacket,
        updated_at: new Date().toISOString()
      });
      storage.saveState(nextState);
      this.afterPrioritySaved(text, nextState, nextState.homework_plan, 'server');
    }).catch(() => {
      const plan = priority.classifyHomework(text, current.weak_points || [], Number(this.data.minutes));
      const nextState = Object.assign({}, current, {
        source: 'mini-upload-local-fallback',
        homework_text: text,
        image_count: this.data.imagePaths.length,
        upload_intake_packet: uploadIntakePacket,
        homework_plan: plan,
        updated_at: new Date().toISOString()
      });
      storage.saveState(nextState);
      this.afterPrioritySaved(text, nextState, plan, 'local');
    }).finally(() => {
      wx.hideLoading();
      this.setData({ submitting: false });
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  openEntryDetail(event) {
    const scene = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.scene
      : 'upload';
    wx.navigateTo({ url: `/pages/entry-detail/entry-detail?scene=${scene || 'upload'}` });
  },

  goReview() {
    navigation.navigateLearningRoute('/pages/review/review');
  },

  goLearningMap() {
    wx.navigateTo({ url: '/pages/entry-detail/entry-detail?scene=today&from=upload' });
  },

  viewLatestReport() {
    const cta = this.data.lastReportCta || {};
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'upload',
        dimensionId: 'upload_to_report_material',
        label: cta.title || 'upload_report_ready',
        route: cta.route || '/pages/profile/profile',
        readiness: cta.sourceSchemaId || 'report_ready'
      });
    }
    navigation.navigateLearningRoute(cta.route || '/pages/profile/profile?from=upload_report_ready');
  },

  runReportFollowupAction() {
    const cta = this.data.lastReportCta || {};
    this.saveReportHandoff(cta);
    navigation.navigateLearningRoute(cta.actionRoute || '/pages/tutor/tutor?from=upload_report_ready');
  },

  runReportGameAction() {
    const cta = this.data.lastReportCta || {};
    if (!cta.gameRoute) {
      wx.showToast({
        title: '先补真实证据',
        icon: 'none'
      });
      navigation.navigateLearningRoute(cta.actionRoute || '/pages/upload/upload?from=material_evidence_gate');
      return;
    }
    this.saveReportHandoff(cta);
    navigation.navigateLearningRoute(cta.gameRoute);
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
      storage.recordUnifiedNextAction(Object.assign({}, next, { surface: 'upload' }));
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'upload',
        dimensionId: next.source || 'unified_next_action',
        label: next.actionLabel || '',
        route: next.route || '',
        readiness: 'unified_next_action'
      });
    }
    navigation.navigateLearningRoute(next.route || '/pages/tutor/tutor');
  },

  goIntakeAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const route = dataset.route || '/pages/upload/upload';
    const packet = this.data.uploadIntakePacket || {};
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'upload',
        dimensionId: 'upload_intake_next_action',
        label: packet.kind || 'upload_intake',
        route,
        readiness: 'intake_action_queue'
      });
    }
    navigation.navigateLearningRoute(route);
  },

});
