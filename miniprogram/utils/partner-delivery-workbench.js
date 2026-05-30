'use strict';

const BLOCKED_CLAIMS = [
  'talent_label',
  'personality_label',
  'auto_grading',
  'score_ranking',
  'guaranteed_improvement',
  'full_answer',
  'raw_photo',
  'full_dialogue',
  'child_name',
  'parent_phone',
  'parent_wechat',
  'contact_info',
  'medical_or_psychological_diagnosis'
];

const ALLOWED_CRM_FIELDS = [
  'child_code',
  'grade_band',
  'evidence_stage',
  'primary_mode',
  'primary_package',
  'next_action',
  'parent_confirmation_status',
  'followup_due_day'
];

const MATERIAL_KIND_MAP = {
  talent_assessment: 'assessment_report',
  wrong_question_paper: 'wrong_question_set',
  wrong_question_photo: 'wrong_question_observation',
  school_material: 'school_feedback',
  parent_report: 'parent_observation',
  manual_notes: 'parent_observation',
  pdf_excerpt: 'learning_material_excerpt',
  wechat_article: 'learning_material_excerpt',
  web_article: 'learning_material_excerpt'
};

function text(value) {
  return String(value || '').trim();
}

function list(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => text(item)).filter(Boolean);
  return String(value).split(/[,\n|;]+/).map((item) => text(item)).filter(Boolean);
}

function sanitizePartnerAction(value = '', fallback = '') {
  const raw = text(value);
  const safeFallback = text(fallback) || 'Confirm the guarded family plan and next evidence window.';
  if (!raw) return safeFallback;
  const unsafe = /name|phone|mobile|wechat|score|ranking|rank|percentile|photo|image|raw|answer|solution|dialogue|transcript|diagnosis|talent|personality|Ming|分数|排名|名次|照片|原图|原题|答案|解法|完整对话|聊天记录|诊断|天赋|性格|手机号|电话|微信/i.test(raw);
  if (unsafe) return safeFallback;
  return raw.slice(0, 140);
}

function sanitizePartnerLabel(value = '', fallback = '') {
  const raw = text(value);
  const safeFallback = text(fallback) || 'partner_loop';
  if (!raw) return safeFallback;
  const unsafe = /name|phone|mobile|wechat|score|ranking|rank|percentile|photo|image|raw|answer|solution|dialogue|transcript|diagnosis|talent|personality|Ming|分数|排名|名次|照片|原图|原题|答案|解法|完整对话|聊天记录|诊断|天赋|性格|手机号|电话|微信/i.test(raw);
  if (unsafe) return safeFallback;
  return raw.slice(0, 48);
}

function stableChildCode(profile = {}, seed = '') {
  const raw = [
    profile.childId,
    profile.id,
    profile.nickname,
    profile.grade,
    seed,
    'child'
  ].map(text).find(Boolean) || 'child';
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) >>> 0;
  }
  return `child_${hash.toString(36).slice(0, 8)}`;
}

function normalizeMaterial(material = {}, index = 0) {
  const sourceSchemaId = text(material.sourceSchemaId || material.source_schema_id || material.type || material.kind || 'parent_report');
  const kind = MATERIAL_KIND_MAP[sourceSchemaId] || 'learning_material_excerpt';
  const sourceAlias = `${kind}_${index + 1}`;
  const evidenceSignals = material.structuredEvidenceSignals || material.evidenceSignals || {};
  const hasRealTaskEvidence = !!(
    evidenceSignals.firstStep
    || evidenceSignals.stuckFirstStep
    || evidenceSignals.wrongCause
    || evidenceSignals.wrongCauseGuess
    || sourceSchemaId === 'wrong_question_paper'
  );
  return {
    id: text(material.id) || `material_${index + 1}`,
    sourceSchemaId,
    kind,
    title: sourceAlias,
    sourceAlias,
    status: hasRealTaskEvidence ? 'evidence_ready' : 'needs_real_task_evidence',
    evidenceSignals: {
      subject: text(evidenceSignals.subjectLabel || evidenceSignals.subjectKey || material.subject),
      questionType: text(evidenceSignals.questionType || material.questionType),
      firstStep: text(evidenceSignals.firstStep || evidenceSignals.stuckFirstStep),
      wrongCause: text(evidenceSignals.wrongCause || evidenceSignals.wrongCauseGuess)
    },
    partnerVisible: ['source_alias', 'kind', 'status', 'subject', 'question_type', 'next_evidence'],
    privateFieldsKeptLocal: ['title', 'label', 'raw_filename', 'raw_report_name', 'source_text_excerpt'],
    blockedFields: BLOCKED_CLAIMS.slice()
  };
}

function buildChildRecord(profile = {}, materials = [], options = {}) {
  const confirmed = !!(options.parentConfirmed || profile.parentConfirmed);
  const evidenceReadyCount = materials.filter((item) => item.status === 'evidence_ready').length;
  const childCode = stableChildCode(profile, materials.map((item) => item.id).join('|'));
  return {
    id: childCode,
    displayName: childCode,
    displayAlias: `student_${childCode.slice(-4)}`,
    gradeBand: text(profile.gradeBand || profile.grade || options.grade) || 'unknown',
    evidenceStage: evidenceReadyCount > 0 ? 'real_task_evidence_ready' : 'assessment_or_observation_only',
    parentConfirmationStatus: confirmed ? 'confirmed' : 'required_before_delivery',
    privateFieldsKeptLocal: ['name', 'phone', 'wechat', 'parent_contact', 'raw_report', 'photo', 'full_dialogue', 'score_detail'],
    partnerViewPolicy: 'de_identified_delivery_only'
  };
}

function pickPrimaryMode(servicePathway = {}, aiAnalysis = {}, materials = []) {
  const mode = servicePathway.primaryMode || {};
  if (mode.id) return { id: mode.id, label: sanitizePartnerLabel(mode.label, mode.id), route: mode.route || '' };
  const hasWrongQuestion = materials.some((item) => item.kind.indexOf('wrong_question') >= 0);
  const recommended = aiAnalysis.recommendedProductLoop || {};
  if (hasWrongQuestion) {
    return { id: 'socratic_private_tutor', label: 'Socratic private tutor', route: '/pages/tutor/tutor?from=partner_workbench' };
  }
  return {
    id: text(recommended.entry) || 'method_validation',
    label: 'Method validation',
    route: recommended.route || '/pages/tutor/tutor?from=partner_workbench'
  };
}

function pickPrimaryPackage(servicePathway = {}, childRecord = {}) {
  const tier = servicePathway.primaryTier || {};
  if (tier.id) return { id: tier.id, label: sanitizePartnerLabel(tier.label, tier.id) };
  return childRecord.evidenceStage === 'real_task_evidence_ready'
    ? { id: 'seven_day_family_execution', label: '7-day family execution' }
    : { id: 'assessment_interpretation_addon', label: 'Assessment interpretation add-on' };
}

function buildSolutionPipeline(childRecord, primaryMode, primaryPackage, materials = []) {
  const evidenceReady = childRecord.evidenceStage === 'real_task_evidence_ready';
  const parentConfirmed = childRecord.parentConfirmationStatus === 'confirmed';
  return [
    {
      id: 'intake',
      label: 'Material intake',
      owner: 'partner_or_parent',
      status: materials.length ? 'done' : 'blocked',
      releaseGate: 'material_type_and_private_field_gate'
    },
    {
      id: 'ai_draft',
      label: 'Guarded AI draft',
      owner: 'server_ai_plus_local_rules',
      status: materials.length ? 'ready_for_manual_confirmation' : 'blocked',
      releaseGate: 'blocked_claim_sanitizer_and_json_schema'
    },
    {
      id: 'family_execution',
      label: primaryMode.label,
      owner: 'family',
      status: evidenceReady && parentConfirmed
        ? 'ready'
        : evidenceReady
          ? 'needs_parent_confirmation'
          : 'locked',
      releaseGate: evidenceReady
        ? 'parent_confirmation_required'
        : 'real_wrong_question_or_homework_required'
    },
    {
      id: 'service_offer',
      label: primaryPackage.label,
      owner: 'advisor',
      status: evidenceReady && childRecord.parentConfirmationStatus === 'confirmed' ? 'offer_allowed' : 'offer_locked',
      releaseGate: 'evidence_based_offer_only'
    }
  ];
}

function buildAdvisorQueue(childRecord, materials = [], servicePathway = {}) {
  const needsEvidence = childRecord.evidenceStage !== 'real_task_evidence_ready';
  const parentConfirmed = childRecord.parentConfirmationStatus === 'confirmed';
  const nextAction = needsEvidence
    ? 'Ask parent to add one real wrong question or homework stuck point before any paid package.'
    : sanitizePartnerAction(
      servicePathway.nextAction,
      'Confirm the 7-day plan and start one first-step task.'
    );
  return [
    {
      id: 'confirm_parent_consent',
      priority: 1,
      status: childRecord.parentConfirmationStatus === 'confirmed' ? 'done' : 'todo',
      action: 'Confirm parent permission and scope of material use.'
    },
    {
      id: 'complete_evidence',
      priority: 2,
      status: needsEvidence ? 'todo' : 'done',
      action: nextAction
    },
    {
      id: 'schedule_day7_review',
      priority: 3,
      status: needsEvidence || !parentConfirmed ? 'locked' : 'todo',
      action: 'Schedule day-7 review with confirmed evidence, not anxiety or sensitive comparison.'
    }
  ];
}

function buildCrmExport(childRecord, primaryMode, primaryPackage, advisorQueue = []) {
  const next = advisorQueue.find((item) => item.status === 'todo') || advisorQueue[0] || {};
  const readyForDay7 = childRecord.evidenceStage === 'real_task_evidence_ready'
    && childRecord.parentConfirmationStatus === 'confirmed';
  return {
    allowedFields: ALLOWED_CRM_FIELDS.slice(),
    blockedFields: BLOCKED_CLAIMS.slice(),
    row: {
      child_code: childRecord.id,
      grade_band: childRecord.gradeBand,
      evidence_stage: childRecord.evidenceStage,
      primary_mode: primaryMode.id,
      primary_package: primaryPackage.id,
      next_action: next.action || '',
      parent_confirmation_status: childRecord.parentConfirmationStatus,
      followup_due_day: readyForDay7 ? 7 : 1
    }
  };
}

function buildPilotReadinessChecklist(childRecord, materials = [], solutionPipeline = [], crmExport = {}) {
  const hasMaterial = materials.length > 0;
  const hasRealTask = childRecord.evidenceStage === 'real_task_evidence_ready';
  const hasConsent = childRecord.parentConfirmationStatus === 'confirmed';
  const crmSafe = !!(crmExport && Array.isArray(crmExport.blockedFields) && crmExport.blockedFields.includes('full_answer'));
  const hasExecutablePlan = solutionPipeline.some((item) => item.id === 'family_execution' && item.status === 'ready');
  const rows = [
    {
      id: 'material_intake',
      label: 'Material intake',
      ready: hasMaterial,
      nextAction: hasMaterial ? 'Use the sanitized material ledger.' : 'Collect one parent-approved report or observation.'
    },
    {
      id: 'real_task_evidence',
      label: 'Real task evidence',
      ready: hasRealTask,
      nextAction: hasRealTask ? 'Open the 7-day family execution path.' : 'Add one real wrong question or homework stuck point.'
    },
    {
      id: 'parent_confirmation',
      label: 'Parent confirmation',
      ready: hasConsent,
      nextAction: hasConsent ? 'Keep the confirmed delivery scope.' : 'Confirm parent permission before service delivery.'
    },
    {
      id: 'safe_partner_view',
      label: 'Safe partner view',
      ready: crmSafe,
      nextAction: crmSafe ? 'Export only the allowed CRM row.' : 'Block raw material and sensitive fields before handoff.'
    },
    {
      id: 'executable_family_plan',
      label: 'Executable family plan',
      ready: hasExecutablePlan,
      nextAction: hasExecutablePlan ? 'Start tonight with one first-step task.' : 'Keep the offer as interpretation until evidence is ready.'
    }
  ];
  const readyCount = rows.filter((item) => item.ready).length;
  return {
    id: 'partner_pilot_readiness_checklist',
    title: 'Partner pilot readiness',
    score: Math.round((readyCount / rows.length) * 100),
    status: readyCount === rows.length ? 'ready_for_partner_pilot' : 'pilot_needs_more_evidence',
    rows,
    operatorScript: hasRealTask
      ? 'We can start with one guarded 7-day family execution loop, then review evidence before any larger service offer.'
      : 'We can interpret the report, but we need one real homework or wrong-question sample before making a service recommendation.',
    stopRule: 'Do not sell from labels, anxiety, raw scores, or private material. Sell only from confirmed evidence and parent-approved scope.'
  };
}

function buildPartnerPilotDeliveryPacket(childRecord, primaryMode, primaryPackage, solutionPipeline = [], advisorQueue = [], pilotReadinessChecklist = {}, revenueMilestones = []) {
  const hasRealTask = childRecord && childRecord.evidenceStage === 'real_task_evidence_ready';
  const hasConsent = childRecord && childRecord.parentConfirmationStatus === 'confirmed';
  const executionReady = solutionPipeline.some((item) => item.id === 'family_execution' && item.status === 'ready');
  const paidAllowed = revenueMilestones.some((item) => item.id === 'paid_7_day_execution' && item.allowed);
  const upgradeAllowed = revenueMilestones.some((item) => item.id === 'course_or_counselor_upgrade' && item.allowed);
  const nextTodo = advisorQueue.find((item) => item.status === 'todo') || advisorQueue[0] || {};
  const status = executionReady && paidAllowed
    ? 'pilot_packet_ready'
    : hasRealTask && !hasConsent
      ? 'needs_parent_scope'
      : 'needs_real_task_evidence';
  const deliveryRows = [
    {
      id: 'day0_scope',
      label: 'Day 0 scope',
      owner: 'advisor',
      action: hasConsent ? 'Use the confirmed family scope.' : 'Confirm parent-approved scope before delivery.',
      releaseGate: 'parent_confirmation_status'
    },
    {
      id: 'day1_first_step',
      label: 'Day 1 first-step task',
      owner: 'family',
      action: executionReady ? `Start ${primaryMode.label} with one first-step task.` : 'Collect one real wrong-question or homework stuck point.',
      releaseGate: 'real_task_evidence_ready'
    },
    {
      id: 'day2_revisit',
      label: 'Day 2 revisit',
      owner: 'miniapp',
      action: 'Run one near-transfer revisit before changing the method.',
      releaseGate: 'next_day_revisit_evidence'
    },
    {
      id: 'day7_review',
      label: 'Day 7 review',
      owner: 'advisor',
      action: upgradeAllowed ? 'Review retain, downgrade, or upgrade with evidence.' : 'Review evidence before any upgrade discussion.',
      releaseGate: 'day7_evidence_before_upgrade'
    }
  ];
  return {
    id: 'partner_pilot_delivery_packet',
    title: 'Partner pilot delivery packet',
    status,
    statusLine: status === 'pilot_packet_ready'
      ? 'Ready: start a guarded 7-day family execution pilot.'
      : status === 'needs_parent_scope'
        ? 'Hold: parent scope must be confirmed before delivery.'
        : 'Hold: add one real homework or wrong-question evidence sample first.',
    offerLine: paidAllowed
      ? `${primaryPackage.label}: sell a 7-day execution loop, not a result promise.`
      : 'Offer only interpretation and evidence collection until the pilot gates are ready.',
    deliveryRows,
    partnerTalkTrack: [
      'We combine the assessment with real homework evidence before recommending a service.',
      'The first paid unit is a 7-day family execution loop with parent-approved scope.',
      'The miniapp records first step, wrong cause, revisit, and parent confirmation.',
      'Upgrade is discussed only after day-7 evidence, not from labels or anxiety.'
    ],
    blockedPromises: ['score_ranking', 'guaranteed_improvement', 'talent_label', 'full_answer', 'raw_photo', 'full_dialogue'],
    closeNextAction: sanitizePartnerAction(nextTodo.action, 'Confirm scope, add evidence, then start the 7-day pilot.'),
    readinessScore: Number(pilotReadinessChecklist.score || 0),
    crmSafe: true,
    revenueGateLine: paidAllowed
      ? 'Paid pilot allowed after real task evidence and parent confirmation.'
      : 'Paid pilot locked until real task evidence and parent confirmation are both ready.'
  };
}

function buildPartnerDeliveryWorkbench(input = {}) {
  const materialInput = Array.isArray(input.materials)
    ? input.materials
    : input.materials
      ? list(input.materials).map((item) => ({ title: item }))
      : input.material || input.decisionSource
        ? [input.material || input.decisionSource]
        : [];
  const materials = materialInput
      .filter(Boolean)
      .map(normalizeMaterial);
  const childRecord = buildChildRecord(input.childProfile || input.profile || {}, materials, input);
  const primaryMode = pickPrimaryMode(input.servicePathway || {}, input.aiAnalysis || {}, materials);
  const primaryPackage = pickPrimaryPackage(input.servicePathway || {}, childRecord);
  const solutionPipeline = buildSolutionPipeline(childRecord, primaryMode, primaryPackage, materials);
  const advisorQueue = buildAdvisorQueue(childRecord, materials, input.servicePathway || {});
  const crmExport = buildCrmExport(childRecord, primaryMode, primaryPackage, advisorQueue);
  const pilotReadinessChecklist = buildPilotReadinessChecklist(childRecord, materials, solutionPipeline, crmExport);
  const hasRealTaskEvidence = childRecord.evidenceStage === 'real_task_evidence_ready';
  const hasParentConfirmation = childRecord.parentConfirmationStatus === 'confirmed';
  const revenueMilestones = [
    { id: 'free_interpretation', allowed: materials.length > 0, gate: 'material_intake_done' },
    { id: 'paid_7_day_execution', allowed: hasRealTaskEvidence && hasParentConfirmation, gate: 'real_task_evidence_ready_and_parent_confirmation' },
    { id: 'course_or_counselor_upgrade', allowed: hasRealTaskEvidence && hasParentConfirmation, gate: 'day7_review_and_parent_confirmation' }
  ];
  const pilotDeliveryPacket = buildPartnerPilotDeliveryPacket(
    childRecord,
    primaryMode,
    primaryPackage,
    solutionPipeline,
    advisorQueue,
    pilotReadinessChecklist,
    revenueMilestones
  );
  return {
    id: 'partner_delivery_workbench',
    status: !hasRealTaskEvidence
      ? 'needs_real_task_evidence'
      : !hasParentConfirmation
        ? 'needs_parent_confirmation'
        : 'ready_for_guarded_delivery',
    childRecord,
    materialLedger: materials,
    primaryMode,
    primaryPackage,
    solutionPipeline,
    advisorQueue,
    crmExport,
    pilotReadinessChecklist,
    pilotDeliveryPacket,
    revenueMilestones,
    privacyGate: {
      serverKeyOnly: true,
      deIdentifiedPartnerView: true,
      rawMaterialStaysLocalOrServerOnly: true,
      blockedClaims: BLOCKED_CLAIMS.slice(),
      releaseGate: 'parent_confirmed_private_fields_removed'
    },
    nextBestAction: (advisorQueue.find((item) => item.status === 'todo') || advisorQueue[0] || {}).action || ''
  };
}

module.exports = {
  BLOCKED_CLAIMS,
  ALLOWED_CRM_FIELDS,
  normalizeMaterial,
  buildChildRecord,
  buildPilotReadinessChecklist,
  buildPartnerPilotDeliveryPacket,
  buildPartnerDeliveryWorkbench
};
