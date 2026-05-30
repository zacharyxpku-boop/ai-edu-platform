'use strict';

const MODE_CATALOG = [
  {
    id: 'socratic_private_tutor',
    label: '苏格拉底 1 对 1',
    fit: ['说不清第一步', '会想但容易乱', '需要低压追问'],
    action: '先问一个第一步问题，再让孩子用自己的话复述卡点。',
    route: '/pages/tutor/tutor?from=service_pathway&socratic=1'
  },
  {
    id: 'three_minute_mini_lesson',
    label: '3 分钟小课堂',
    fit: ['概念卡住', '需要小黑板', '连续两轮仍不会启动'],
    action: '只讲一个概念缺口，生成三帧小黑板和退出门槛。',
    route: '/pages/tutor/tutor?from=service_pathway&mini_lesson=1'
  },
  {
    id: 'game_recall',
    label: '游戏化轻复练',
    fit: ['会了容易忘', '需要重复巩固', '需要提高坚持度'],
    action: '用一局轻挑战复查同一错因，不奖励最终答案。',
    route: '/pages/arcade/arcade?from=service_pathway'
  },
  {
    id: 'parent_coaching',
    label: '家长陪伴方案',
    fit: ['亲子沟通紧张', '家长不知道怎么问', '作业时间拖长'],
    action: '给家长一条今晚能直接说的低压提问句。',
    route: '/pages/profile/profile?from=service_pathway&parent=1'
  },
  {
    id: 'online_method_course',
    label: '线上学习方法课',
    fit: ['审题方法薄弱', '错题整理无系统', '不会复盘'],
    action: '推荐学习方法课，只承接已被作业证据验证的问题。',
    route: '/pages/profile/profile?from=service_pathway&course=method'
  },
  {
    id: 'wrong_question_repair_course',
    label: '错题修复课',
    fit: ['同类错因反复出现', '变式迁移不稳', '需要题型化修复'],
    action: '按错因进入短周期修复课，先看第一步和近迁移。',
    route: '/pages/review/review?from=service_pathway&course=wrong_question'
  }
];

const PRODUCT_TIERS = [
  {
    id: 'assessment_upgrade',
    label: '测评升级包',
    promise: '报告后补一份 AI 学习方案和 7 天验证任务。',
    entryGate: '有测评/观察材料，但仍需真实作业证据确认。',
    blockedClaims: ['天赋定论', '一次报告决定长期能力', '自动判分']
  },
  {
    id: 'seven_day_companion',
    label: '7 天陪跑',
    promise: '每天一个小任务，验证学习方式是否真的适合孩子。',
    entryGate: '至少有一个真实卡点、错因或家长观察。',
    blockedClaims: ['结果承诺', '替代老师教学', '排名承诺']
  },
  {
    id: 'thirty_day_camp',
    label: '30 天训练营',
    promise: '把高频错因沉淀为课程、复练、家长复盘的稳定节奏。',
    entryGate: '7 天内出现可复现的错因或复习断点。',
    blockedClaims: ['押题', '整卷答案', '公开孩子隐私材料']
  },
  {
    id: 'high_touch_planning',
    label: '高阶学习规划服务',
    promise: '对高需求家庭做阶段规划、课程组合和复盘咨询。',
    entryGate: '家长明确需要长期规划，且已有多源学习证据。',
    blockedClaims: ['医学/心理诊断', '不可验证的能力标签', '包结果']
  }
];

const AI_LOCAL_DELIVERY_SPLIT = [
  {
    id: 'local_release_gate',
    label: '本地代码负责放行',
    owns: ['资料类型识别', '证据是否补齐', '报告/游戏/分享能否放行', '隐私字段拦截'],
    reason: '这些是安全和商业可信度问题，不能交给 AI 临场判断。'
  },
  {
    id: 'ai_expression_layer',
    label: 'AI 负责表达和追问',
    owns: ['测评摘要改写', '苏格拉底追问', '小讲堂一句话解释', '家长可读话术'],
    reason: '这些需要自然语言适配孩子和家长，用 AI 更有弹性。'
  },
  {
    id: 'hybrid_validation_loop',
    label: '混合验证学习方法',
    owns: ['AI 给方法候选', '本地生成 7 天验证任务', '错题/回访确认是否适合'],
    reason: '测评只能给假设，真实作业证据决定是否继续。'
  }
];

const AI_LOCAL_DECISION_MATRIX = [
  {
    id: 'socratic_question_wording',
    module: '苏格拉底点拨',
    betterOwner: 'ai',
    aiUse: '根据孩子当前表达改写追问语气、类比和鼓励方式。',
    localRule: '本地代码决定题型轴、提示层级、答案拦截和是否切入小讲堂。',
    releaseGate: 'blocked_answer_request_must_fallback_to_first_step'
  },
  {
    id: 'mini_lesson_mode_route',
    module: '3 分钟小讲堂',
    betterOwner: 'local_code',
    aiUse: '只生成 AI 老师一句话和 AI 同学常见误区。',
    localRule: '本地代码决定触发阈值、三帧小黑板、退出票据、回访卡和游戏解锁。',
    releaseGate: 'child_exit_ticket_required'
  },
  {
    id: 'learning_preference_report',
    module: '学习偏好/测评资料报告',
    betterOwner: 'hybrid',
    aiUse: '把测评摘要改写成家长能理解的学习方法候选。',
    localRule: '本地代码阻断天赋定性、分数排名、固定分数预期，并生成 7 天验证计划。',
    releaseGate: 'assessment_requires_real_homework_evidence'
  },
  {
    id: 'game_recall_and_xp',
    module: '游戏化轻复练',
    betterOwner: 'local_code',
    aiUse: '改写挑战文案和鼓励语。',
    localRule: '本地代码决定 XP、间隔复习、失败重练、排行榜禁用和分享字段。',
    releaseGate: 'reward_only_first_step_wrong_cause_revisit'
  },
  {
    id: 'parent_partner_handoff',
    module: '家长/合作方交付包',
    betterOwner: 'local_code',
    aiUse: '生成低压家长话术和服务候选摘要。',
    localRule: '本地代码只放行今晚行动、家长问题、下一证据和服务候选。',
    releaseGate: 'private_fields_removed_before_partner_view'
  }
];

const PUBLIC_K12_BORROW_PLAYBOOK = [
  {
    id: 'official_curriculum_standards',
    label: '公开课标 / 教材结构',
    sourceKind: 'public_reference',
    bestUse: '搭课程骨架、年级轴、章节轴和题型路由。',
    localCodeOwns: ['课程骨架', '题型路由', '报告放行门槛', '来源登记'],
    aiBetterFor: ['把课标改写成孩子能懂的第一步', '把老师话术压成家长可读句'],
    mustNotUse: ['复制原文段落', '包装成官方题库', '自动给标准答案'],
    productEntry: '课程体系/知识点路由'
  },
  {
    id: 'public_oer_materials',
    label: '公开 OER / 开放许可资料',
    sourceKind: 'public_reference',
    bestUse: '补概念解释、例题变式和可验证的学习动作。',
    localCodeOwns: ['license_gate', 'source_registry', 'reuse_scope', 'share_blocklist'],
    aiBetterFor: ['改写成小黑板说明', '生成一问一答的孩子版解释'],
    mustNotUse: ['未核查许可直接复用', '生成整套答案包', '把外部图文当自有内容发布'],
    productEntry: '概念解释 / 轻练习'
  },
  {
    id: 'family_uploaded_material',
    label: '家长上传测评 / 错题 / 试卷 / 观察',
    sourceKind: 'private_family_material',
    bestUse: '形成今晚行动、错因卡、家长复盘和 7 天游程。',
    localCodeOwns: ['隐私闸门', '答案封存', '分享脱敏', '长期画像放行门槛'],
    aiBetterFor: ['把材料改写成家长能看懂的话', '把错因转成第一步提问'],
    mustNotUse: ['天赋定性', '自动判分承诺', '公开原题或完整对话'],
    productEntry: '上传入口 / 家庭决策报告'
  },
  {
    id: 'school_feedback',
    label: '学校反馈 / 老师留言',
    sourceKind: 'school_private_material',
    bestUse: '家校协同摘要、观察问题、下一步家长动作。',
    localCodeOwns: ['家校摘要放行', '去隐私字段', '不替老师判断'],
    aiBetterFor: ['把老师留言改写成一句家长可执行的话'],
    mustNotUse: ['外传原题照片', '替老师评分', '生成家校对立文案'],
    productEntry: '家校协同 / 报告摘要'
  },
  {
    id: 'generated_practice_variants',
    label: '本地生成的变式 / 复练 / 回访卡',
    sourceKind: 'product_generated',
    bestUse: '把真实材料变成可练、可回访、可复核的动作卡。',
    localCodeOwns: ['答案释放', 'XP 奖励', '间隔复习', '分享字段'],
    aiBetterFor: ['改写题面语气', '生成更自然的孩子话术'],
    mustNotUse: ['直接给完整答案', '把变式包装成新题库版权', '替代真实回访'],
    productEntry: '轻复练 / 闯关 / 分享回流'
  }
];

const SEVEN_DAY_VALIDATION_PLAN = [
  { day: 1, label: '今晚', action: '只试一个学习方法候选，并记录孩子自己的第一步。', evidence: 'child_first_step' },
  { day: 2, label: '明天', action: '遮住答案回访同一第一步，看是否转身还记得。', evidence: 'next_day_revisit' },
  { day: 3, label: '第 3 天', action: '换一道同题型小变式，只看是否能迁移第一步。', evidence: 'near_transfer' },
  { day: 5, label: '第 5 天', action: '进入一局轻复练，验证错因是否复现。', evidence: 'game_recall' },
  { day: 7, label: '第 7 天', action: '家长复盘：保留、降级或换一种学习方法。', evidence: 'family_decision' }
];

const COMMERCIAL_CLAIM_BLOCKLIST = [
  '固定分数预期',
  '固定成绩提升预期',
  '保分',
  '升学承诺',
  '天赋定性',
  '一次报告决定长期能力',
  '自动判分',
  '整卷答案',
  '排名承诺'
];

const PARTNER_HANDOFF_POLICY = {
  id: 'partner_handoff_policy',
  visibleToPartner: ['tonight_action', 'parent_question', 'next_evidence', 'service_candidate'],
  blockedFields: ['original_question', 'photo', 'full_answer', 'score', 'ranking', 'talent_label', 'full_dialogue', 'child_name', 'parent_phone', 'parent_wechat', 'contact_info'],
  rule: '合作方只看服务候选、今晚行动和下一条证据；不看原题、照片、完整答案、分数排名、天赋标签、完整对话、孩子姓名或家长联系方式。',
  releaseGate: 'parent_confirmed_and_private_fields_removed'
};

const MODE_CHOICE_GUARDRAILS = [
  {
    id: 'socratic_stays_default',
    rule: '有真实作业卡点时，默认先走苏格拉底 1 对 1 点拨。'
  },
  {
    id: 'mini_lesson_is_rescue',
    rule: '小讲堂只在概念、图解或连续启动失败时补位，结束必须留下孩子退出票。'
  },
  {
    id: 'game_after_evidence',
    rule: '轻练习必须在第一步或错因证据之后开启，不能只靠测评标签开启。'
  },
  {
    id: 'parent_confirms_service',
    rule: '任何课程、训练营或合作服务候选，都要先经过家长确认。'
  }
];

function textOf(value) {
  return String(value || '').trim();
}

function includesAny(text, tokens) {
  const source = textOf(text);
  return tokens.some((token) => source.indexOf(token) >= 0);
}

function inferSignals(input = {}) {
  const sourceText = textOf(input.sourceText || input.text);
  const schemaId = textOf(input.sourceSchemaId || input.sourceSchema || (input.decisionSource && input.decisionSource.sourceSchemaId));
  const structured = input.structuredEvidenceSignals || {};
  const reportDraft = input.reportDraft || {};
  const behavior = reportDraft.behaviorSignals || {};
  const wrongCause = textOf(structured.wrongCause || structured.wrongCauseGuess || behavior.wrongCause);
  const firstStep = textOf(structured.firstStep || structured.stuckFirstStep || behavior.firstStep);
  const questionType = textOf(structured.questionType || behavior.questionType);
  const parentConfirmed = !!(input.parentConfirmed
    || input.parent_confirmation
    || input.parentConfirmation
    || (input.profile && input.profile.parentConfirmed)
    || (input.childRecord && input.childRecord.parentConfirmationStatus === 'confirmed'));
  return {
    schemaId,
    sourceText,
    wrongCause,
    firstStep,
    questionType,
    parentConfirmed,
    hasTaskClassification: !!questionType,
    hasRealTaskEvidence: !!(wrongCause || firstStep || input.cardId || Number(input.importedCards || 0) > 0),
    hasAssessment: schemaId === 'talent_assessment' || includesAny(sourceText, ['测评', '学习偏好', '视觉', '听觉', '报告']),
    hasWrongQuestion: schemaId === 'wrong_question_paper' || schemaId === 'wrong_question_photo' || includesAny(sourceText, ['错题', '错因', '订正', '不会', '卡住']),
    hasSchoolFeedback: schemaId === 'school_material' || includesAny(sourceText, ['老师', '学校', '课堂', '作业反馈']),
    hasParentObservation: schemaId === 'parent_report' || includesAny(sourceText, ['家长', '晚上', '拖拉', '情绪', '观察']),
    needsBlackboard: includesAny(sourceText + wrongCause + firstStep, ['图', '小黑板', '物理', '化学', '地理', '几何', '电路', '光路']),
    needsMemory: includesAny(sourceText + wrongCause, ['忘', '复习', '反复', '同类', '变式', '迁移']),
    needsParentSupport: includesAny(sourceText, ['家长', '情绪', '拖拉', '不愿意', '沟通', '陪'])
  };
}

function pickModes(signals) {
  const ids = new Set(['socratic_private_tutor', 'parent_coaching']);
  if (signals.needsBlackboard && signals.hasRealTaskEvidence) ids.add('three_minute_mini_lesson');
  if (signals.hasRealTaskEvidence && (signals.needsMemory || signals.hasWrongQuestion)) ids.add('game_recall');
  if (signals.hasAssessment) ids.add('online_method_course');
  if (signals.hasWrongQuestion && signals.hasRealTaskEvidence) ids.add('wrong_question_repair_course');
  return MODE_CATALOG
    .filter((mode) => ids.has(mode.id))
    .map((mode, index) => Object.assign({}, mode, {
      priority: index + 1,
      localGate: mode.id === 'game_recall'
        ? '必须先有真实错因或第一步证据'
        : mode.id === 'online_method_course'
          ? '只按方法候选推荐，不把测评当定论'
          : '孩子能说出第一步或家长能补充观察'
    }));
}

function buildLockedModeCards(signals, modeRecommendations) {
  const activeIds = new Set((modeRecommendations || []).map((mode) => mode.id));
  const lockedIds = [];
  if (!signals.hasRealTaskEvidence) {
    lockedIds.push('three_minute_mini_lesson', 'game_recall');
  }
  return MODE_CATALOG
    .filter((mode) => lockedIds.includes(mode.id) && !activeIds.has(mode.id))
    .map((mode) => Object.assign({}, mode, {
      childCanChoose: false,
      parentConfirmRequired: true,
      choiceRole: mode.id === 'three_minute_mini_lesson'
        ? 'locked_rescue_bridge'
        : 'locked_memory_loop',
      lockReason: mode.id === 'three_minute_mini_lesson'
        ? 'requires_repeated_real_homework_stuck_evidence'
        : 'requires_real_first_step_or_wrong_cause_evidence',
      localGate: mode.id === 'three_minute_mini_lesson'
        ? '必须先有真实作业卡点，并在苏格拉底点拨里连续卡住'
        : '必须先有真实第一步、错因或回访证据',
      exitEvidenceRequired: mode.id === 'three_minute_mini_lesson'
        ? ['real_homework_stuck', 'socratic_still_blocked', 'child_exit_ticket']
        : ['child_first_step', 'wrong_cause_revisit', 'parent_safe_share_line']
    }));
}

function pickTiers(signals) {
  const tiers = [];
  if (signals.hasAssessment) tiers.push('assessment_upgrade');
  tiers.push('seven_day_companion');
  if (signals.hasWrongQuestion && signals.hasRealTaskEvidence) tiers.push('thirty_day_camp');
  if ((signals.hasAssessment && signals.hasParentObservation) || signals.hasSchoolFeedback) tiers.push('high_touch_planning');
  return PRODUCT_TIERS.filter((tier) => tiers.includes(tier.id));
}

function buildModeChoiceProtocol(signals, modeRecommendations, options = {}) {
  const recommended = modeRecommendations[0] || MODE_CATALOG[0];
  const hasRealTaskEvidence = !!(signals && signals.hasRealTaskEvidence);
  const blockedModeCards = buildLockedModeCards(signals || {}, modeRecommendations || []);
  const choiceCards = modeRecommendations.map((mode) => {
    const isGame = mode.id === 'game_recall';
    const isMiniLesson = mode.id === 'three_minute_mini_lesson';
    const locked = (isGame && !hasRealTaskEvidence) || (mode.id === 'wrong_question_repair_course' && !hasRealTaskEvidence);
    return Object.assign({}, mode, {
      recommended: mode.id === recommended.id,
      childCanChoose: !locked,
      parentConfirmRequired: mode.id === 'online_method_course'
        || mode.id === 'wrong_question_repair_course'
        || mode.id === 'parent_coaching',
      choiceRole: isMiniLesson
        ? 'rescue_or_concept_bridge'
        : isGame
          ? 'memory_and_return_loop'
          : mode.id === 'socratic_private_tutor'
            ? 'default_private_tutor'
            : 'family_service_support',
      lockReason: locked ? 'requires_real_first_step_or_wrong_cause_evidence' : '',
      exitEvidenceRequired: isMiniLesson
        ? ['one_blackboard_frame', 'child_exit_ticket', 'near_transfer_prompt']
        : isGame
          ? ['recall_attempt', 'wrong_cause_revisit', 'parent_safe_share_line']
          : ['child_first_step', 'parent_one_question']
    });
  });
  return {
    id: 'family_learning_mode_choice_protocol',
    title: '家庭学习模式选择',
    recommendedModeId: recommended.id,
    recommendedModeLabel: recommended.label,
    childChoiceAllowed: choiceCards.some((card) => card.childCanChoose),
    parentConfirmRequired: true,
    choiceCards,
    blockedModeCards,
    guardrails: MODE_CHOICE_GUARDRAILS,
    decisionOrder: ['socratic_private_tutor', 'three_minute_mini_lesson', 'game_recall', 'parent_coaching', 'online_method_course', 'wrong_question_repair_course'],
    positioningLine: '小讲堂不是孩子随便选择的 AI 课堂；主线仍是苏格拉底家庭私教，只有真实作业连续卡住后才短时补位。',
    releaseGate: options.releaseGate || (hasRealTaskEvidence ? 'mode_choice_requires_parent_confirmation' : 'mode_choice_requires_real_task_evidence')
  };
}

function buildPartnerServiceDeliveryLedger(signals = {}, modeRecommendations = [], productTiers = [], validationPlan = []) {
  const hasRealTaskEvidence = !!(signals && signals.hasRealTaskEvidence);
  const parentConfirmed = !!(signals && signals.parentConfirmed);
  const primaryMode = modeRecommendations[0] || MODE_CATALOG[0];
  const primaryTier = productTiers[0] || PRODUCT_TIERS[1];
  const deliveryStatus = !hasRealTaskEvidence
    ? 'pre_sale_needs_real_task_evidence'
    : parentConfirmed
      ? 'deliverable_after_parent_confirmation'
      : 'needs_parent_confirmation';
  return {
    id: 'partner_service_delivery_ledger',
    status: deliveryStatus,
    title: 'Partner service delivery ledger',
    packageCards: [
      {
        id: 'assessment_interpretation',
        label: 'Assessment interpretation add-on',
        deliverable: 'Turn report into learning method candidates, not talent labels.',
        entryGate: 'partner_material_uploaded_and_parent_confirmed',
        nextRoute: '/pages/upload/upload?from=partner_delivery_ledger'
      },
      {
        id: 'seven_day_execution',
        label: '7-day family execution',
        deliverable: 'One first-step task, one next-day revisit, one day-7 variant.',
        entryGate: hasRealTaskEvidence
          ? parentConfirmed
            ? 'real_task_evidence_ready_and_parent_confirmed'
            : 'parent_confirmation_required'
          : 'blocked_until_real_wrong_question',
        nextRoute: '/pages/profile/profile?from=partner_delivery_ledger'
      },
      {
        id: 'course_or_counselor_handoff',
        label: primaryTier.label || 'service handoff',
        deliverable: `Route to ${primaryMode.label || primaryMode.id} only after evidence.`,
        entryGate: 'evidence_based_offer_only',
        nextRoute: primaryMode.route || '/pages/tutor/tutor?from=partner_delivery_ledger'
      }
    ],
    crmFields: [
      { id: 'child_profile_status', allowed: true, field: 'evidence_stage' },
      { id: 'primary_mode', allowed: true, field: primaryMode.id || '' },
      { id: 'primary_tier', allowed: true, field: primaryTier.id || '' },
      { id: 'next_service_candidate', allowed: true, field: primaryTier.label || '' },
      { id: 'original_question', allowed: false, field: 'blocked' },
      { id: 'score_ranking', allowed: false, field: 'blocked' },
      { id: 'talent_label', allowed: false, field: 'blocked' }
    ],
    revenueLoop: [
      { id: 'lead', owner: 'partner', action: 'upload confirmed report or observation' },
      { id: 'diagnose', owner: 'miniapp', action: 'build guarded method candidates and family action book' },
      { id: 'execute', owner: 'family', action: 'finish one 7-day evidence loop in product' },
      { id: 'convert', owner: 'operator', action: 'offer course, companion, or high-touch planning only from evidence' },
      { id: 'renew', owner: 'operator', action: 'renew from next evidence gap, not anxiety or ranking' }
    ],
    validationPlan: Array.isArray(validationPlan) ? validationPlan.slice(0, 7) : [],
    blockedClaims: COMMERCIAL_CLAIM_BLOCKLIST.concat(['talent_label', 'full_answer', 'score_ranking']),
    partnerVisibleFields: PARTNER_HANDOFF_POLICY.visibleToPartner.slice(),
    partnerBlockedFields: PARTNER_HANDOFF_POLICY.blockedFields.slice(),
    releaseGate: !hasRealTaskEvidence
      ? 'real_homework_evidence_required_before_commercial_push'
      : parentConfirmed
        ? 'parent_confirmed_private_fields_removed'
        : 'parent_confirmation_required_before_partner_delivery'
  };
}

function buildPostPilotRetentionLoop(signals = {}, partnerLedger = {}, validationPlan = [], productTiers = []) {
  const hasRealTaskEvidence = !!(signals && signals.hasRealTaskEvidence);
  const parentConfirmed = !!(signals && signals.parentConfirmed);
  const canStartPilot = hasRealTaskEvidence && parentConfirmed;
  const primaryTier = productTiers[0] || PRODUCT_TIERS[1] || {};
  const day7 = (Array.isArray(validationPlan) ? validationPlan : []).find((item) => Number(item.day || 0) >= 7) || {};
  const day7Evidence = day7.evidence || 'family_decision';
  return {
    id: 'post_pilot_retention_loop',
    status: canStartPilot ? 'ready_after_day7_evidence' : 'locked_until_evidence_and_parent_confirmation',
    title: '7-day pilot retention loop',
    decisionOwner: 'local_rules_before_operator_offer',
    day7Evidence,
    stages: [
      {
        id: 'retain_current_mode',
        label: 'retain current mode',
        condition: 'day7 evidence shows lower friction and the child can repeat the first step',
        action: 'keep the current mode for another 7-day loop',
        gate: 'day7_evidence_ready'
      },
      {
        id: 'downgrade_to_parent_script',
        label: 'downgrade pressure',
        condition: 'parent reports pressure rising or child cannot produce a first step',
        action: 'reduce to one parent question and one revisit card',
        gate: 'pressure_safe_before_more_service'
      },
      {
        id: 'upgrade_to_service_pack',
        label: primaryTier.label || 'upgrade service pack',
        condition: 'same wrong cause repeats and parent has confirmed the handoff scope',
        action: 'offer the smallest evidence-based service pack',
        gate: canStartPilot ? 'evidence_based_offer_allowed' : 'locked_until_parent_confirmation'
      },
      {
        id: 'renew_next_gap',
        label: 'renew from next evidence gap',
        condition: 'new evidence gap is visible in the report',
        action: 'renew only around the next gap, not labels or anxiety',
        gate: 'next_evidence_gap_required'
      }
    ],
    operatorScript: canStartPilot
      ? 'Review day-7 evidence first: retain, downgrade, or offer the smallest next service pack.'
      : 'Do not sell the pilot yet. Collect real task evidence and parent confirmation first.',
    crmFollowup: {
      day: canStartPilot ? 7 : 1,
      reason: canStartPilot ? 'day7_evidence_review' : 'evidence_or_consent_missing',
      allowedFields: ['evidence_stage', 'primary_mode', 'next_evidence_gap', 'parent_confirmation_status'],
      blockedFields: PARTNER_HANDOFF_POLICY.blockedFields.slice()
    },
    safetyRules: [
      'no score guarantee',
      'no talent label',
      'no raw question or full answer in partner handoff',
      'no upgrade before day-7 evidence'
    ],
    evidenceRequired: ['real_task_evidence', 'parent_confirmation', 'day7_validation', 'next_evidence_gap', 'safe_partner_handoff'],
    ledgerStatus: partnerLedger.status || ''
  };
}

function buildPersonalizedClosureBridge(signals = {}, modeRecommendations = [], validationPlan = [], partnerLedger = {}, postPilotRetentionLoop = {}, input = {}) {
  const hasRealTaskEvidence = !!(signals && signals.hasRealTaskEvidence);
  const parentConfirmed = !!(signals && signals.parentConfirmed);
  const primaryMode = modeRecommendations[0] || MODE_CATALOG[0];
  const questionType = signals.questionType || (input.structuredEvidenceSignals && input.structuredEvidenceSignals.questionType) || 'unknown';
  const subject = (input.structuredEvidenceSignals && (input.structuredEvidenceSignals.subjectLabel || input.structuredEvidenceSignals.subjectKey))
    || input.subject
    || 'unknown';
  const sourceSchemaId = signals.schemaId || input.sourceSchemaId || 'unknown';
  const sourceTextReady = !!String(signals.sourceText || input.sourceText || '').trim();
  const contentDensity = hasRealTaskEvidence ? 'sample_backed_execution' : sourceTextReady ? 'needs_real_task_anchor' : 'needs_material_excerpt';
  const openedModes = new Set((modeRecommendations || []).map((item) => item && item.id).filter(Boolean));
  const day7Ready = Array.isArray(validationPlan) && validationPlan.some((item) => Number(item.day || 0) >= 7);
  const lockedBecause = [];
  if (!hasRealTaskEvidence) lockedBecause.push('real_task_evidence_missing');
  if (!parentConfirmed) lockedBecause.push('parent_confirmation_missing');
  if (!day7Ready) lockedBecause.push('day7_validation_missing');
  return {
    id: 'personalized_upload_score_closure_bridge',
    status: hasRealTaskEvidence ? 'ready_for_guided_execution' : 'blocked_until_real_task_evidence',
    sourceSchemaId,
    subject,
    questionType,
    contentScalePlan: {
      id: 'content_scale_plan',
      density: contentDensity,
      stableStrategyRequired: true,
      sourceMaterialReady: sourceTextReady,
      sampleAnchorRequired: !hasRealTaskEvidence,
      nextExpansionQueue: [
        { id: 'grade_chapter_type', action: 'map subject, grade/chapter, and task type before lesson or game release' },
        { id: 'first_step_bank', action: 'pick a first-step strategy from sample-backed or local fallback cards' },
        { id: 'near_transfer_variant', action: 'create one day-7 variant only after child first-step evidence' }
      ]
    },
    socraticStressFallback: {
      id: 'socratic_stress_fallback',
      defaultMode: 'socratic_private_tutor',
      openedMiniLesson: openedModes.has('three_minute_mini_lesson'),
      fallbackOrder: [
        'first_step_probe',
        'two_choice_micro_prompt',
        'blackboard_one_frame',
        'parent_one_question',
        'next_day_revisit'
      ],
      stopRule: 'after three stuck turns, stop prompting and downgrade to parent handoff plus next-day revisit',
      aiMayRewrite: ['child_friendly_prompt_wording', 'parent_readable_explanation'],
      localCodeOwns: ['answer_boundary', 'fallback_order', 'mini_lesson_release', 'report_release_gate']
    },
    gameRetentionPlan: {
      id: 'healthy_game_retention_plan',
      openedGameRecall: openedModes.has('game_recall'),
      dailyReturnCard: hasRealTaskEvidence ? 'most_worth_return_card_from_wrong_cause' : 'locked_until_first_step_or_wrong_cause',
      xpGate: 'child_first_step + wrong_cause_named + next_day_revisit_locked',
      antiAddiction: ['one_primary_card_only', 'no_ranking_pressure', 'no_infinite_scroll', 'no_score_reward'],
      comebackRoute: openedModes.has('game_recall') ? '/pages/arcade/arcade?from=personalized_closure_bridge' : '/pages/review/review?from=personalized_closure_bridge'
    },
    scoreReportBridge: {
      id: 'score_report_bridge',
      useScoreFor: ['priority_only', 'weak_subject_selection', 'parent_private_review'],
      neverUseScoreFor: ['xp', 'ranking', 'share_payload', 'talent_label'],
      route: '/pages/profile/profile?from=personalized_closure_bridge',
      releaseGate: 'score_is_private_parent_signal'
    },
    uploadMaterialBridge: {
      id: 'upload_material_bridge',
      route: sourceSchemaId === 'wrong_question_paper'
        ? '/pages/review/review?from=personalized_closure_bridge'
        : '/pages/tutor/tutor?from=personalized_closure_bridge',
      aiContractRequired: true,
      manualConfirmationRequired: true,
      localFallback: 'local_family_solution_draft_requires_manual_confirmation'
    },
    endToEndRoutes: [
      { id: 'upload', route: '/pages/upload/upload?from=personalized_closure_bridge', gate: 'material_excerpt_or_structured_evidence' },
      { id: 'tutor', route: '/pages/tutor/tutor?from=personalized_closure_bridge', gate: 'first_step_only' },
      { id: 'review', route: '/pages/review/review?from=personalized_closure_bridge', gate: 'wrong_cause_named' },
      { id: 'game', route: '/pages/arcade/arcade?from=personalized_closure_bridge', gate: 'next_day_revisit_locked' },
      { id: 'parent', route: '/pages/profile/profile?from=personalized_closure_bridge', gate: 'parent_confirmation_and_private_fields_removed' }
    ],
    releaseGates: [
      'real_task_evidence_before_game',
      'three_round_socratic_fallback_before_mini_lesson',
      'score_private_parent_signal_only',
      'ai_material_analysis_sanitized',
      'parent_confirmation_before_partner_delivery',
      'day7_variant_before_method_claim'
    ],
    blockedFields: PARTNER_HANDOFF_POLICY.blockedFields.concat(['full_solution', 'reward_release', 'service_upgrade_without_evidence']),
    evidenceRequired: [
      'source_material_excerpt',
      'subject_task_type',
      'child_first_step',
      'wrong_cause_named',
      'next_day_revisit',
      'day7_variant',
      'parent_confirmation',
      'safe_partner_handoff'
    ],
    lockedBecause,
    partnerLedgerStatus: partnerLedger.status || '',
    postPilotStatus: postPilotRetentionLoop.status || '',
    localDeterministic: true
  };
}

function buildLearningServicePathway(input = {}) {
  const signals = inferSignals(input);
  const modeRecommendations = pickModes(signals);
  const productTiers = pickTiers(signals);
  const firstMode = modeRecommendations[0] || MODE_CATALOG[0];
  const firstTier = productTiers[0] || PRODUCT_TIERS[1];
  const requiresEvidenceBeforeCommercialPush = signals.hasAssessment && !signals.hasRealTaskEvidence;
  const modeChoiceProtocol = buildModeChoiceProtocol(signals, modeRecommendations, {
    releaseGate: requiresEvidenceBeforeCommercialPush
      ? 'mode_choice_requires_real_task_evidence'
      : 'mode_choice_requires_parent_confirmation'
  });
  const quickAssessmentBridge = {
    id: 'quick_learning_preference_assessment',
    label: '小程序内 15 题学习偏好快测',
    route: '/pages/profile/profile?from=service_pathway&panel=report&quick_assessment=1',
    useWhen: '没有第三方测评，或测评只给了笼统标签时使用。',
    releaseRule: '快测结果只进入学习方法候选，必须用真实错题、隔天回访和第 7 天小变式验证。'
  };
  const validationPlan = SEVEN_DAY_VALIDATION_PLAN.map((item) => Object.assign({}, item, {
    locked: requiresEvidenceBeforeCommercialPush && item.day > 1,
    unlockRule: item.day === 1 ? '可立即执行' : '先补真实作业卡点和孩子第一步'
  }));
  const safeProductTiers = productTiers.map((tier) => Object.assign({}, tier, {
    blockedClaims: Array.from(new Set([].concat(tier.blockedClaims || [], COMMERCIAL_CLAIM_BLOCKLIST)))
  }));
  const publicK12BorrowPlaybook = PUBLIC_K12_BORROW_PLAYBOOK.map((item, index) => Object.assign({}, item, {
    priority: index + 1,
    recommended: index === 0,
    route: index === 2
      ? '/pages/upload/upload?from=service_pathway&material=1'
      : index === 3
        ? '/pages/profile/profile?from=service_pathway&panel=report'
        : index === 4
          ? '/pages/arcade/arcade?from=service_pathway&mode=recall'
          : '/pages/tutor/tutor?from=service_pathway'
  }));
  const partnerServiceDeliveryLedger = buildPartnerServiceDeliveryLedger(
    signals,
    modeRecommendations,
    safeProductTiers,
    validationPlan
  );
  const postPilotRetentionLoop = buildPostPilotRetentionLoop(
    signals,
    partnerServiceDeliveryLedger,
    validationPlan,
    safeProductTiers
  );
  const personalizedClosureBridge = buildPersonalizedClosureBridge(
    signals,
    modeRecommendations,
    validationPlan,
    partnerServiceDeliveryLedger,
    postPilotRetentionLoop,
    input
  );
  return {
    id: 'learning_service_pathway',
    status: requiresEvidenceBeforeCommercialPush ? 'needs_real_task_validation' : 'ready_for_family_plan',
    title: '学习服务路径建议',
    summary: requiresEvidenceBeforeCommercialPush
      ? '先把测评报告转成学习方法候选，再用真实错题或作业验证。'
      : '已可把本次材料接到今晚行动、轻复练、家长复盘和后续课程服务。',
    primaryMode: firstMode,
    primaryTier: firstTier,
    modeRecommendations,
    modeChoiceProtocol,
    productTiers: safeProductTiers,
    nextAction: requiresEvidenceBeforeCommercialPush
      ? '补一条真实错题/作业卡点，再放行课程或训练营建议。'
      : `先进入${firstMode.label}，再根据 7 天复盘决定是否进入${firstTier.label}。`,
    familyVisibleLine: requiresEvidenceBeforeCommercialPush
      ? '这份报告先帮助我们选择学习方式，不能直接给孩子贴标签。'
      : '这次材料已经能形成今晚任务、明天回访和下一阶段服务建议。',
    commercialLoop: [
      { step: '入口', owner: '合作/家长侧', action: '测评、错题、学校反馈或家长观察进入小程序' },
      { step: '方案', owner: '原点智学', action: '生成 AI 学习路径、第一步任务和家长话术' },
      { step: '验证', owner: '家庭', action: '7 天内用真实作业和回访验证学习方式' },
      { step: '转化', owner: '双方共营', action: '进入线上课、训练营或高阶学习规划' }
    ],
    quickAssessmentBridge,
    aiLocalDeliverySplit: AI_LOCAL_DELIVERY_SPLIT,
    aiLocalDecisionMatrix: AI_LOCAL_DECISION_MATRIX,
    publicK12BorrowPlaybook,
    validationPlan,
    partnerServiceDeliveryLedger,
    postPilotRetentionLoop,
    personalizedClosureBridge,
    partnerHandoffPolicy: Object.assign({}, PARTNER_HANDOFF_POLICY),
    moatLine: '护城河不在“生成一份测评结论”，而在测评、错题、回访、游戏和家长决策反复闭环后的家庭证据账本。',
    safetyBoundary: {
      allowed: ['学习方式建议', '第一步点拨', '家长陪伴话术', '课程/训练营候选'],
      blocked: Array.from(new Set(['天赋定论', '自动判分', '整卷答案', '结果承诺', '公开原题或孩子隐私材料'].concat(COMMERCIAL_CLAIM_BLOCKLIST))),
      releaseGate: requiresEvidenceBeforeCommercialPush
        ? 'assessment_requires_real_homework_evidence'
        : 'service_pathway_requires_parent_confirmation'
    },
    signals
  };
}

module.exports = {
  MODE_CATALOG,
  PRODUCT_TIERS,
  PUBLIC_K12_BORROW_PLAYBOOK,
  AI_LOCAL_DECISION_MATRIX,
  MODE_CHOICE_GUARDRAILS,
  inferSignals,
  buildModeChoiceProtocol,
  buildPartnerServiceDeliveryLedger,
  buildPostPilotRetentionLoop,
  buildPersonalizedClosureBridge,
  buildLearningServicePathway
};
