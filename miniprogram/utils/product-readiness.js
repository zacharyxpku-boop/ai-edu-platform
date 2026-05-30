function count(list) {
  return Array.isArray(list) ? list.length : 0;
}

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function evidenceItem(id, label, ready, evidence = [], gap = '') {
  return {
    id,
    label,
    ready: !!ready,
    evidence: (Array.isArray(evidence) ? evidence : [evidence]).filter(Boolean),
    gap: ready ? '' : gap
  };
}

function scoreFromItems(items = []) {
  if (!items.length) return 0;
  return Math.round((items.filter((item) => item.ready).length / items.length) * 100);
}

const BENCHMARK_CAPABILITIES = [
  {
    id: 'guided_tutor',
    label: 'guided tutor does not leak final answers',
    dimensionIds: ['guided_tutor']
  },
  {
    id: 'material_to_active_recall',
    label: 'uploaded or entered material becomes reviewable practice',
    dimensionIds: ['material_to_review', 'spaced_recall']
  },
  {
    id: 'light_entry_to_core_loop',
    label: 'light entries create reusable first-step evidence',
    dimensionIds: ['light_entry_evidence']
  },
  {
    id: 'report_to_next_action',
    label: 'assessment output routes into a concrete learning plan',
    dimensionIds: ['report_to_solution']
  },
  {
    id: 'motivation_loop',
    label: 'light game play writes back learning evidence',
    dimensionIds: ['game_retention']
  },
  {
    id: 'parent_evidence_loop',
    label: 'parent side sees evidence instead of a static report wall',
    dimensionIds: ['parent_evidence']
  },
  {
    id: 'share_return_loop',
    label: 'share cards carry the next action back into the learning loop',
    dimensionIds: ['share_return']
  },
  {
    id: 'local_recovery',
    label: 'weak-network and local recovery path is diagnosable',
    dimensionIds: ['local_resilience']
  },
  {
    id: 'depth_compounding',
    label: 'learning evidence compounds across tutor, recall, practice, parent, and return visits',
    dimensionIds: ['depth_compounding']
  },
  {
    id: 'pattern_to_decision',
    label: 'weekly learning pattern turns into a concrete next action',
    dimensionIds: ['weekly_pattern', 'decision_path']
  },
  {
    id: 'mastery_to_intervention',
    label: 'mastery rubric drives intervention and outcome review',
    dimensionIds: ['mastery_rubric', 'intervention_playbook', 'outcome_review']
  }
];

const MODULE_FLOW_CONTRACTS = [
  {
    id: 'home_to_tutor',
    module: 'home',
    entry: 'home_or_upload',
    output: 'guided_tutor_first_step',
    requiredDimensionIds: ['guided_tutor']
  },
  {
    id: 'tutor_to_focus',
    module: 'tutor',
    entry: 'guided_tutor_first_step',
    output: 'focus_cabin',
    requiredDimensionIds: ['guided_tutor']
  },
  {
    id: 'focus_to_review_evidence',
    module: 'focus',
    entry: 'focus_cabin',
    output: 'review_or_parent_evidence',
    requiredDimensionIds: ['guided_tutor', 'parent_evidence', 'spaced_recall']
  },
  {
    id: 'material_to_review',
    module: 'upload_or_revisit',
    entry: 'home_or_upload',
    output: 'review_card',
    requiredDimensionIds: ['material_to_review']
  },
  {
    id: 'upload_to_report_material',
    module: 'upload',
    entry: 'manual_material_or_photo_note',
    output: 'report_or_review_material',
    requiredDimensionIds: ['material_to_review', 'report_to_solution', 'local_resilience']
  },
  {
    id: 'revisit_to_practice_asset',
    module: 'revisit',
    entry: 'tool_entry',
    output: 'review_or_practice_asset',
    requiredDimensionIds: ['light_entry_evidence', 'material_to_review', 'game_retention']
  },
  {
    id: 'light_entry_to_profile',
    module: 'daily_math_dictation_light_diagnosis',
    entry: 'light_entry',
    output: 'parent_visible_light_evidence',
    requiredDimensionIds: ['light_entry_evidence', 'parent_evidence']
  },
  {
    id: 'module_to_recall_card',
    module: 'module',
    entry: 'mini_learning_loop',
    output: 'recall_card_or_tutor_step',
    requiredDimensionIds: ['guided_tutor', 'material_to_review', 'spaced_recall']
  },
  {
    id: 'report_to_plan',
    module: 'learning_report',
    entry: 'learning_report_solution',
    output: 'review_card_and_seven_day_plan',
    requiredDimensionIds: ['report_to_solution', 'material_to_review']
  },
  {
    id: 'review_to_recall',
    module: 'review',
    entry: 'review_card',
    output: 'next_day_revisit',
    requiredDimensionIds: ['spaced_recall']
  },
  {
    id: 'practice_to_record',
    module: 'arcade',
    entry: 'light_practice_game',
    output: 'parent_recap',
    requiredDimensionIds: ['game_retention', 'parent_evidence']
  },
  {
    id: 'parent_recap_to_revisit',
    module: 'profile',
    entry: 'parent_recap',
    output: 'next_day_revisit',
    requiredDimensionIds: ['parent_evidence', 'local_resilience']
  },
  {
    id: 'share_to_landing_next_action',
    module: 'share',
    entry: 'family_action_card',
    output: 'incoming_share_next_action',
    requiredDimensionIds: ['share_return', 'decision_path']
  },
  {
    id: 'report_to_family_action',
    module: 'profile',
    entry: 'parent_decision_report',
    output: 'family_action_or_intervention',
    requiredDimensionIds: ['decision_path', 'weekly_pattern', 'intervention_playbook']
  },
  {
    id: 'weekly_pattern_to_next_action',
    module: 'profile',
    entry: 'weekly_pattern',
    output: 'next_best_action',
    requiredDimensionIds: ['weekly_pattern', 'decision_path']
  },
  {
    id: 'mastery_to_intervention',
    module: 'profile',
    entry: 'mastery_rubric',
    output: 'intervention_playbook_and_outcome_review',
    requiredDimensionIds: ['mastery_rubric', 'intervention_playbook', 'outcome_review']
  }
];

const USER_TRIAL_SCENARIOS = [
  {
    id: 'first_homework_help',
    persona: 'student_with_homework_stuck_point',
    entry: 'home',
    targetOutcome: 'child states the first step, then enters focus and review',
    requiredDimensionIds: ['guided_tutor', 'material_to_review', 'parent_evidence']
  },
  {
    id: 'parent_report_to_solution',
    persona: 'parent_with_score_or_assessment_material',
    entry: 'profile_or_upload',
    targetOutcome: 'report becomes a 7-day plan and routes to review/focus',
    requiredDimensionIds: ['report_to_solution', 'material_to_review', 'spaced_recall']
  },
  {
    id: 'child_low_motivation_revisit',
    persona: 'child_wants_light_practice',
    entry: 'revisit_or_arcade',
    targetOutcome: 'light game writes learning evidence and missed cards return to review',
    requiredDimensionIds: ['game_retention', 'spaced_recall', 'parent_evidence']
  },
  {
    id: 'child_light_entry_to_core',
    persona: 'child_starts_from_small_light_tool',
    entry: 'daily_math_or_dictation',
    targetOutcome: 'light entry creates first-step evidence and parent sees where to continue',
    requiredDimensionIds: ['light_entry_evidence', 'parent_evidence', 'decision_path']
  },
  {
    id: 'weak_network_return_visit',
    persona: 'family_returns_after_exit_or_weak_network',
    entry: 'profile',
    targetOutcome: 'local record, sync diagnostics, and next-day revisit remain available',
    requiredDimensionIds: ['local_resilience', 'parent_evidence', 'spaced_recall']
  },
  {
    id: 'parent_weekly_decision',
    persona: 'parent_after_several_nights',
    entry: 'profile',
    targetOutcome: 'parent sees the repeated pattern and a concrete next action',
    requiredDimensionIds: ['weekly_pattern', 'decision_path', 'parent_evidence']
  },
  {
    id: 'parent_mastery_intervention',
    persona: 'parent_needs_to_know_if_it_worked',
    entry: 'profile',
    targetOutcome: 'parent sees mastery level, intervention plan, and outcome review',
    requiredDimensionIds: ['mastery_rubric', 'intervention_playbook', 'outcome_review']
  },
  {
    id: 'shared_family_card_return',
    persona: 'second_parent_opens_shared_card',
    entry: 'share_landing',
    targetOutcome: 'shared family card lands with the same next action and routeable detail',
    requiredDimensionIds: ['share_return', 'parent_evidence', 'decision_path']
  }
];

const MATURITY_AREAS = [
  {
    id: 'product_completeness',
    label: 'product completeness',
    requiredDimensionIds: ['guided_tutor', 'report_to_solution', 'material_to_review', 'light_entry_evidence', 'parent_evidence']
  },
  {
    id: 'workflow_closure',
    label: 'end-to-end workflow closure',
    requiredDimensionIds: ['guided_tutor', 'report_to_solution', 'material_to_review', 'light_entry_evidence', 'spaced_recall', 'game_retention', 'parent_evidence', 'share_return']
  },
  {
    id: 'technical_stability',
    label: 'local technical stability and recovery',
    requiredDimensionIds: ['local_resilience', 'spaced_recall']
  },
  {
    id: 'user_experience_maturity',
    label: 'zero-help user experience maturity',
    requiredDimensionIds: ['guided_tutor', 'light_entry_evidence', 'game_retention', 'parent_evidence', 'share_return', 'local_resilience', 'depth_compounding', 'weekly_pattern', 'decision_path', 'mastery_rubric', 'intervention_playbook', 'outcome_review']
  }
];

const AI_USAGE_DECISION_MATRIX = [
  {
    id: 'socratic_hint_generation',
    module: 'tutor',
    decision: 'ai_required_with_local_guardrail',
    label: '作业点拨追问生成',
    reason: '用户输入高熵，AI 负责把题干、卡点和孩子原话改写成合适追问。',
    localFallback: 'tutor-ladder 题型规则、答案拦截、第一步提示、错因模板必须本地可用。',
    guardrail: 'AI 不得直接给最终答案；本地规则先拦截代写、拍题出答案、完整板书。'
  },
  {
    id: 'report_draft_interpretation',
    module: 'profile',
    decision: 'ai_enhanced_not_required',
    label: '学习报告文字解读',
    reason: 'AI 可把成绩单、错因和家长描述整理成更自然的报告语言。',
    localFallback: '长期画像、7 天行动、家长今晚决策、家校协同必须由本地证据账本生成。',
    guardrail: '没有足够证据时只给观察建议，不下长期定性结论。'
  },
  {
    id: 'question_variant_generation',
    module: 'review',
    decision: 'ai_enhanced_not_required',
    label: '变式题和复述提示',
    reason: 'AI 可以快速生成同错因小变式，提高内容规模。',
    localFallback: '错因卡、近迁移、间隔复习、掌握度 gate 必须由本地规则维持。',
    guardrail: '变式只练第一步和错因，不生成可抄的完整答案。'
  },
  {
    id: 'visual_blackboard_explanation',
    module: 'tutor_review',
    decision: 'ai_enhanced_not_required',
    label: '第一步小黑板说明',
    reason: 'AI 可把抽象题干转成更自然的图解语言。',
    localFallback: '七科小黑板 blueprint、boardMove、parentCheck 必须本地可用。',
    guardrail: '只画第一步、对象、方向、证据或关系，不承诺全科自动动态板书。'
  },
  {
    id: 'homework_intake_routing',
    module: 'home_upload',
    decision: 'local_rule_required',
    label: '作业入口路由和题型初判',
    reason: '入口路由必须稳定、可解释、弱网可用。',
    localFallback: '关键词、页面入口、任务类型、下一步 route 全部本地计算。',
    guardrail: 'AI 只能在路由后补充解释，不能决定隐私字段、支付、分享和核心导航。'
  },
  {
    id: 'spaced_recall_scheduler',
    module: 'review_arcade',
    decision: 'local_rule_required',
    label: '间隔复习和记忆调度',
    reason: '复习时间、错因回访和 leech card 必须确定可复现。',
    localFallback: 'SM-2、dueDate、错因复现、每日上限、streak rescue 全部本地规则。',
    guardrail: 'AI 不得改变到期队列、删除复习证据或夸大学会程度。'
  },
  {
    id: 'game_reward_xp',
    module: 'arcade',
    decision: 'local_rule_required',
    label: 'XP、任务、成就和游戏反馈',
    reason: '奖励系统需要一致、公平、无模型漂移。',
    localFallback: 'XP、等级、streak、成就、每日任务全部本地规则。',
    guardrail: '不做排名刺激，不用 AI 生成比较同学、分数或班级地位。'
  },
  {
    id: 'share_privacy_and_return',
    module: 'share',
    decision: 'local_rule_required',
    label: '分享字段、隐私边界和回流参数',
    reason: '分享天然涉及隐私和传播，必须确定性过滤。',
    localFallback: 'allowedFields、blockedFields、query、回流 route 和能力缺口全部本地生成。',
    guardrail: '禁止原题照片、完整对话、分数、排名、完整答案出现在分享 payload。'
  },
  {
    id: 'parent_gate_and_release',
    module: 'profile',
    decision: 'local_rule_required',
    label: '家长决策 gate 和画像放行',
    reason: '家长侧结论影响家庭行为，必须由证据门槛驱动。',
    localFallback: '画像可信度、观察周期、决策阈值、今晚做/不做全部本地规则。',
    guardrail: 'AI 只能润色表达，不能绕过两周稳定性和证据锁。'
  },
  {
    id: 'safety_content_boundary',
    module: 'global',
    decision: 'local_rule_required',
    label: '代写、直给答案、假能力和隐私拦截',
    reason: '安全边界不能依赖模型心情。',
    localFallback: 'ANSWER_REQUEST_RE、负例样本、隐私字段阻断、假拍题/假板书拦截必须本地通过。',
    guardrail: '任何 AI 输出都要受本地边界二次检查。'
  }
];

const FINAL_TARGET_REQUIREMENTS = [
  {
    id: 'chinese_material_import',
    label: '中文材料导入',
    benchmark: '对标 Gizmo 的资料进来就能变成练习，但只承诺粘贴摘录和自有材料。',
    dimensionIds: ['material_to_review', 'local_resilience'],
    requiredLocalEvidence: ['upload_to_report_material', 'material_to_review'],
    route: '/pages/upload/upload?from=final_target_gap&target=chinese_material_import',
    nextAction: '继续把公众号摘录、网页摘录、PDF 摘录转成来源包和回访卡，不做自动抓取承诺。'
  },
  {
    id: 'active_recall_loop',
    label: '高频记忆与主动回忆',
    benchmark: '对标 Gizmo 的 active recall 和 spaced repetition。',
    dimensionIds: ['spaced_recall', 'game_retention'],
    requiredLocalEvidence: ['review_to_recall', 'practice_to_record'],
    route: '/pages/review/review?from=final_target_gap&target=active_recall_loop',
    nextAction: '把今日 3 张主动回忆、错因回放、明日回访继续压到 Review 和 Arcade 的同一条链上。'
  },
  {
    id: 'socratic_tutor_depth',
    label: '苏格拉底点拨深度',
    benchmark: '对标 Khanmigo 的不代写、不泄答案、追问孩子下一步。',
    dimensionIds: ['guided_tutor'],
    requiredLocalEvidence: ['home_to_tutor', 'tutor_to_focus'],
    route: '/pages/tutor/tutor?from=final_target_gap&target=socratic_tutor_depth',
    nextAction: 'AI 只做追问语气和解释改写，本地继续收紧题型、错因、停止条件和安全回退。'
  },
  {
    id: 'curriculum_question_bank',
    label: '课程/题型体系',
    benchmark: '对标 Khan Academy 的课程骨架，但先做中国 K12 课标结构和题型蓝图。',
    dimensionIds: ['material_to_review', 'guided_tutor', 'spaced_recall'],
    requiredLocalEvidence: ['module_to_recall_card', 'report_to_plan'],
    route: '/pages/entry-detail/entry-detail?scene=tutor&from=final_target_gap&target=curriculum_question_bank',
    nextAction: '继续把 7 科题型卡沉淀为第一步、小黑板、错因、迁移和掌握门槛，不复制公开原题。'
  },
  {
    id: 'visual_first_step_board',
    label: '第一步小黑板',
    benchmark: '借鉴千问板书式讲解，但不追全科动态板书和拍题出答案。',
    dimensionIds: ['guided_tutor', 'parent_evidence'],
    requiredLocalEvidence: ['tutor_to_focus', 'focus_to_review_evidence'],
    route: '/pages/tutor/tutor?from=final_target_gap&target=visual_first_step_board',
    nextAction: '只画对象、条件、方向、证据句或空位，继续避免完整答案和假动态板书。'
  },
  {
    id: 'parent_longitudinal_portrait',
    label: '长期学习画像',
    benchmark: '对标 Khanmigo 的家长/老师可见证据，但聚焦家庭今晚行动。',
    dimensionIds: ['parent_evidence', 'weekly_pattern', 'mastery_rubric', 'outcome_review'],
    requiredLocalEvidence: ['weekly_pattern_to_next_action', 'mastery_to_intervention'],
    route: '/pages/profile/profile?from=final_target_gap&target=parent_longitudinal_portrait',
    nextAction: '继续把 1/3/7 晚证据、两周稳定门和干预复盘做成家长一句话决策。'
  },
  {
    id: 'wechat_safe_share_relay',
    label: '微信安全分享接力',
    benchmark: '借微信生态做接力，不做排行榜、晒分和公共原题传播。',
    dimensionIds: ['share_return', 'decision_path'],
    requiredLocalEvidence: ['share_to_landing_next_action'],
    route: '/pages/home/home?from=final_target_gap&target=wechat_safe_share_relay',
    nextAction: '继续让分享卡带下一步、错因和接收侧动作，不带原题、答案、照片、分数和排名。'
  },
  {
    id: 'commercial_launch_ops',
    label: '商用发布条件',
    benchmark: '对标真实可商用小程序，而不是本机 Demo。',
    dimensionIds: ['local_resilience'],
    requiredExternalBlockers: ['real_appid', 'production_ai_provider'],
    route: '/pages/profile/profile?from=final_target_gap&target=commercial_launch_ops',
    nextAction: '本地代码继续保持可跑；公开发布前必须完成真实 AppID、生产模型、内容安全和真机体验。'
  }
];

const HIGH_LEVERAGE_LOCAL_STRETCH_BACKLOG = [
  {
    id: 'k12_content_system_scale',
    label: '7 科内容规模与课程题型体系',
    currentPercent: 72,
    targetPercent: 100,
    owner: 'local_code_with_public_source_boundary',
    benchmark: 'Gizmo 的材料转练习效率 + Khan Academy 的课程骨架',
    action: '继续把公开 K12 结构沉淀成 grade/subject/unit/taskType/firstStep/wrongCause/boardMove/revisit，不复制原题和答案。',
    stopWhen: '7 科高频题型都有样本、第一步、小黑板、错因、迁移、复习与分享证据。'
  },
  {
    id: 'ai_socratic_quality_eval',
    label: 'AI 点拨质量与失败兜底压测',
    currentPercent: 68,
    targetPercent: 100,
    owner: 'local_eval_plus_ai_wording',
    benchmark: 'Khanmigo 的引导式 tutor，但不泄露完整答案',
    action: '本地代码继续扩题型、错因轴、停止条件、负例样本和三轮追问评测；AI 只负责儿童表达和家长解释。',
    stopWhen: '每类题型都有 answer-request、沉默、错轴、迁移失败四类兜底，并通过本地负例测试。'
  },
  {
    id: 'gizmo_level_daily_play',
    label: 'Gizmo 级每日主动回忆与游戏留存',
    currentPercent: 64,
    targetPercent: 100,
    owner: 'local_game_rules',
    benchmark: 'active recall、spaced repetition、daily quest、study game',
    action: '继续把 Review 和 Arcade 压成每日 90 秒回看、错因 replay、XP gate、streak rescue 和次日回访同一条链。',
    stopWhen: '用户每天打开时只有一个主回忆动作，错卡必回流，XP 不奖励盲刷题量。'
  },
  {
    id: 'parent_talent_decision_report',
    label: '家长天赋/错题/试卷决策报告',
    currentPercent: 76,
    targetPercent: 100,
    owner: 'local_release_gate_with_ai_summary',
    benchmark: 'Khanmigo 家长/教师证据视角，但聚焦家庭今晚行动',
    action: '继续把天赋测评、错题试卷、老师反馈和孩子作业过程统一成证据账本、两周稳定门槛和家校沟通摘要。',
    stopWhen: '报告能明确说今晚怎么学、什么不能判断、还缺什么证据、何时才更新长期画像。'
  },
  {
    id: 'visual_first_step_blackboard',
    label: '第一步小黑板与视觉解释',
    currentPercent: 70,
    targetPercent: 100,
    owner: 'local_visual_schema_plus_ai_copy',
    benchmark: '千问式板书方向，但只承诺第一步图解',
    action: '继续沉淀对象、条件、方向、证据句、变量、结构骨架等视觉 schema，不做拍题全答案和假动态板书。',
    stopWhen: '7 科核心题型都有可视化第一步 schema、失败分支和退出标准。'
  },
  {
    id: 'community_safe_share_relay',
    label: '社区化安全分享与接力',
    currentPercent: 74,
    targetPercent: 100,
    owner: 'local_privacy_and_return_route',
    benchmark: '微信生态传播，但不做排行晒分',
    action: '继续让分享卡只带第一步、错因、回访和接收者动作，禁止原题、答案、分数、排名和完整对话。',
    stopWhen: '分享接收者能用自己的材料复刻同类第一步，并回流 Review/Arcade/Profile。'
  }
];

function buildAiUsageDecisionMatrix() {
  const rows = AI_USAGE_DECISION_MATRIX.map((item) => Object.assign({}, item, {
    needsAI: item.decision === 'ai_required_with_local_guardrail',
    mayUseAI: item.decision === 'ai_required_with_local_guardrail' || item.decision === 'ai_enhanced_not_required',
    mustWorkOffline: item.decision === 'local_rule_required' || item.decision === 'ai_enhanced_not_required'
  }));
  const counts = rows.reduce((acc, item) => {
    acc[item.decision] = (acc[item.decision] || 0) + 1;
    return acc;
  }, {});
  const localRuleRows = rows.filter((item) => item.decision === 'local_rule_required');
  const aiRows = rows.filter((item) => item.mayUseAI);
  return {
    id: 'ai_usage_decision_matrix',
    title: 'AI 使用分级矩阵',
    principle: '高熵解释用 AI，确定性闭环用规则；AI 增强不等于 AI 依赖。',
    rows,
    counts,
    aiRows,
    localRuleRows,
    releaseRule: '没有生产模型时，小程序仍必须完成入口、点拨兜底、错因卡、复习、家长复盘、分享安全回流。',
    blockedAiAreas: localRuleRows.map((item) => item.id),
    providerDependencyLine: `${aiRows.length} 个模块可用 AI 增强；${localRuleRows.length} 个模块必须本地规则可跑。`
  };
}

function mapById(items = []) {
  return items.reduce((acc, item) => {
    if (item && item.id) acc[item.id] = item;
    return acc;
  }, {});
}

function buildFinalTargetGapMeter(readiness = {}, acceptanceBits = {}) {
  const dimensions = Array.isArray(readiness.dimensions) ? readiness.dimensions : [];
  const dimensionMap = mapById(dimensions);
  const moduleFlowMap = Array.isArray(acceptanceBits.moduleFlowMap) ? acceptanceBits.moduleFlowMap : [];
  const flowMap = mapById(moduleFlowMap);
  const externalBlockers = Array.isArray(readiness.externalBlockers) ? readiness.externalBlockers : [];
  const externalMap = mapById(externalBlockers);
  const rows = FINAL_TARGET_REQUIREMENTS.map((target) => {
    const dimensionEvidence = (target.dimensionIds || [])
      .map((id) => dimensionMap[id])
      .filter(Boolean);
    const flowEvidence = (target.requiredLocalEvidence || [])
      .map((id) => flowMap[id])
      .filter(Boolean);
    const externalEvidence = (target.requiredExternalBlockers || [])
      .map((id) => externalMap[id])
      .filter(Boolean);
    const localReady = dimensionEvidence.length === (target.dimensionIds || []).length
      && dimensionEvidence.every((item) => item.ready)
      && flowEvidence.length === (target.requiredLocalEvidence || []).length
      && flowEvidence.every((item) => item.status === 'closed');
    const externalBlocked = externalEvidence.some((item) => item.blockingLaunch);
    const status = localReady
      ? (externalBlocked ? 'external_blocked' : 'ready')
      : 'local_gap';
    const progress = Math.round((
      dimensionEvidence.filter((item) => item.ready).length
      + flowEvidence.filter((item) => item.status === 'closed').length
    ) / Math.max(1, (target.dimensionIds || []).length + (target.requiredLocalEvidence || []).length) * 100);
    return {
      id: target.id,
      label: target.label,
      benchmark: target.benchmark,
      status,
      progress,
      missingDimensionIds: (target.dimensionIds || []).filter((id) => !dimensionMap[id] || !dimensionMap[id].ready),
      missingFlowIds: (target.requiredLocalEvidence || []).filter((id) => !flowMap[id] || flowMap[id].status !== 'closed'),
      externalBlockerIds: externalEvidence.filter((item) => item.blockingLaunch).map((item) => item.id),
      route: target.route,
      nextAction: target.nextAction
    };
  });
  const readyCount = rows.filter((item) => item.status === 'ready').length;
  const externalBlockedCount = rows.filter((item) => item.status === 'external_blocked').length;
  const localGapCount = rows.filter((item) => item.status === 'local_gap').length;
  const weightedScore = Math.round(rows.reduce((sum, item) => {
    if (item.status === 'ready') return sum + 100;
    if (item.status === 'external_blocked') return sum + 88;
    return sum + item.progress;
  }, 0) / Math.max(1, rows.length));
  const nextLocalTarget = rows.find((item) => item.status === 'local_gap') || null;
  const nextExternalTarget = rows.find((item) => item.status === 'external_blocked') || null;
  const nextTarget = nextLocalTarget || nextExternalTarget || null;
  const marginalStopRule = localGapCount === 0
    ? '本地产品厚度继续堆公开资料的边际收益已低；下一步应转向真机、真实家庭样本、生产服务和留存数据。'
    : '只做能提高导入、点拨、回忆、画像、分享闭环证据的改动；不能提高这些证据的静态资料继续停止。';
  return {
    id: 'final_target_gap_meter',
    title: '距离竞品级商用目标',
    score: weightedScore,
    readyCount,
    externalBlockedCount,
    localGapCount,
    totalCount: rows.length,
    rows,
    distanceLine: `当前 ${readyCount}/${rows.length} 项达到目标，${externalBlockedCount} 项只差外部配置，${localGapCount} 项仍需本地加厚。`,
    nextTargetLabel: nextTarget ? nextTarget.label : '进入真实家庭试用',
    nextAction: nextTarget ? nextTarget.nextAction : '开始小范围家庭试用，按真实失败样本继续迭代。',
    reportingCadence: '每完成一轮本地加厚或同步上传后，用本表汇报还差多少；若只剩外部配置和真实试用，就停止堆代码。',
    marginalStopRule
  };
}

function buildCompetitiveMoatBoard(readiness = {}, finalTargetGapMeter = {}) {
  const rows = Array.isArray(finalTargetGapMeter.rows) ? finalTargetGapMeter.rows : [];
  const rowMap = mapById(rows);
  const picks = [
    {
      id: 'k12_content_system_scale',
      fallbackTargetId: 'curriculum_question_bank',
      label: '学科内容深度',
      route: '/pages/upload/upload?from=competitive_moat_board&type=school_material',
      owner: '本地代码 + 公开资料结构化',
      nextAction: '继续把 7 科公开资料沉淀成题型、错因、第一步、小黑板和回访卡，不搬运原题答案。'
    },
    {
      id: 'ai_socratic_quality_eval',
      fallbackTargetId: 'socratic_tutor_depth',
      label: 'AI 点拨质量',
      route: '/pages/tutor/tutor?from=competitive_moat_board',
      owner: 'AI 追问 + 本地门禁',
      nextAction: '继续压测三轮苏格拉底追问、儿童表达适配和失败兜底，AI 只改写表达，不决定答案。'
    },
    {
      id: 'gizmo_level_daily_play',
      fallbackTargetId: 'active_recall_loop',
      label: '游戏可玩性',
      route: '/pages/arcade/arcade?from=competitive_moat_board',
      owner: '本地游戏规则',
      nextAction: '继续把 XP、主动回忆、错因修复、次日回访压成每日可重复的学习循环。'
    },
    {
      id: 'parent_talent_decision_report',
      fallbackTargetId: 'parent_longitudinal_portrait',
      label: '家长决策书',
      route: '/pages/profile/profile?from=competitive_moat_board&type=parent_report',
      owner: '证据账本 + 报告层',
      nextAction: '继续把天赋测评、错题试卷、学校反馈和家长观察收束成方法候选与下一步决策。'
    },
    {
      id: 'community_safe_share_relay',
      fallbackTargetId: 'wechat_safe_share_relay',
      label: '安全分享接力',
      route: '/pages/profile/profile?from=competitive_moat_board&type=share',
      owner: '本地分享字段',
      nextAction: '继续只分享行动、错因和回访，不分享原题、答案、分数、排名和完整对话。'
    }
  ];
  const boardRows = picks.map((item) => {
    const related = rowMap[item.id] || rowMap[item.fallbackTargetId] || {};
    const progress = Math.max(0, Math.min(100, Number(related.progress || 0)));
    return {
      id: item.id,
      label: item.label,
      owner: item.owner,
      status: related.status || (progress >= 100 ? 'ready' : 'local_gap'),
      progress,
      route: related.route || item.route,
      nextAction: related.nextAction || item.nextAction
    };
  });
  const readyCount = boardRows.filter((item) => item.status === 'ready').length;
  const score = Math.round(boardRows.reduce((sum, item) => sum + item.progress, 0) / Math.max(1, boardRows.length));
  const next = boardRows.find((item) => item.status !== 'ready') || boardRows[0] || null;
  return {
    id: 'competitive_moat_board',
    title: '竞品护城河推进板',
    summary: '把内容深度、AI 点拨、游戏留存、家长决策和安全分享放在同一张推进板里。',
    score,
    readyCount,
    totalCount: boardRows.length,
    remainingCount: Math.max(0, boardRows.length - readyCount),
    rows: boardRows,
    nextAction: next ? next.nextAction : '继续把最薄的一条链先补厚。',
    nextRoute: next ? next.route : '/pages/profile/profile',
    reportingCadence: '每轮验证后汇报五条线还差多少；边际收益低时停止只堆静态资料。',
    marginalStopRule: '如果某条线只是重复加文案、加卡片、加说明，而没有新证据、新回访或新路由，就停下来。',
    distanceLine: `五条线已有 ${readyCount}/${boardRows.length} 条成型，剩余 ${Math.max(0, boardRows.length - readyCount)} 条继续加厚。`
  };
}

function readinessStatus(ready) {
  return ready ? 'ready' : 'gap';
}

function riskLevelFromReadiness(item) {
  if (item.ready) return 'low';
  if (item.id === 'report_to_solution' || item.id === 'guided_tutor' || item.id === 'share_return') return 'high';
  return 'medium';
}

function buildContractStatus(contract, dimensionMap) {
  const evidence = contract.requiredDimensionIds
    .map((id) => dimensionMap[id])
    .filter(Boolean);
  const ready = evidence.length === contract.requiredDimensionIds.length && evidence.every((item) => item.ready);
  return {
    id: contract.id,
    module: contract.module,
    entry: contract.entry,
    output: contract.output,
    status: ready ? 'closed' : 'broken',
    evidence: evidence.flatMap((item) => item.evidence || []),
    missingDimensionIds: contract.requiredDimensionIds.filter((id) => !dimensionMap[id] || !dimensionMap[id].ready)
  };
}

function buildUserTrialScenario(scenario, dimensionMap) {
  const evidence = scenario.requiredDimensionIds
    .map((id) => dimensionMap[id])
    .filter(Boolean);
  const ready = evidence.length === scenario.requiredDimensionIds.length && evidence.every((item) => item.ready);
  return {
    id: scenario.id,
    persona: scenario.persona,
    entry: scenario.entry,
    targetOutcome: scenario.targetOutcome,
    status: ready ? 'pass' : 'blocked',
    zeroHelpReady: ready,
    evidence: evidence.flatMap((item) => item.evidence || []),
    blockingIssues: scenario.requiredDimensionIds
      .filter((id) => !dimensionMap[id] || !dimensionMap[id].ready)
      .map((id) => ({
        id,
        fix: dimensionMap[id] ? dimensionMap[id].gap : 'missing readiness dimension'
      }))
  };
}

function buildPseudoFunctionScan(functionalityChecklist, externalBlockers) {
  const localPseudoFunctions = functionalityChecklist
    .filter((item) => item.status !== 'implemented' || !count(item.evidence))
    .map((item) => ({
      id: item.id,
      name: item.name,
      reason: item.fix || 'missing traceable local evidence'
    }));
  return {
    localPseudoFunctions,
    externalConfigOnly: externalBlockers.map((item) => ({
      id: item.id,
      label: item.label,
      blockingLaunch: !!item.blockingLaunch
    })),
    allDisplayedLocalFunctionsBackedByEvidence: localPseudoFunctions.length === 0
  };
}

function buildMaturityDelta(area, dimensionMap, externalBlockers) {
  const missingDimensionIds = area.requiredDimensionIds.filter((id) => !dimensionMap[id] || !dimensionMap[id].ready);
  const hasBlockingExternal = externalBlockers.some((item) => item.blockingLaunch);
  const gapLevel = missingDimensionIds.length
    ? (missingDimensionIds.length >= 2 ? 'severe' : 'medium')
    : (hasBlockingExternal ? 'external_only' : 'none');
  return {
    id: area.id,
    label: area.label,
    gapLevel,
    localStatus: missingDimensionIds.length ? 'local_gap' : 'local_ready',
    missingDimensionIds,
    evidence: area.requiredDimensionIds
      .map((id) => dimensionMap[id])
      .filter(Boolean)
      .flatMap((item) => item.evidence || []),
    externalBlockers: externalBlockers
      .filter((item) => item.blockingLaunch)
      .map((item) => item.id)
  };
}

function buildReadinessGateChecklist(localReady, moduleFlowMap, userTrialSimulation, pseudoFunctionScan, dimensions, externalBlockers) {
  const dimensionMap = mapById(dimensions);
  return [
    {
      id: 'core_chain_100_percent',
      label: 'core learning loop can run end to end',
      passed: localReady && moduleFlowMap.every((item) => item.status === 'closed')
    },
    {
      id: 'no_local_pseudo_function',
      label: 'all displayed local functions are backed by evidence',
      passed: !!(pseudoFunctionScan && pseudoFunctionScan.allDisplayedLocalFunctionsBackedByEvidence)
    },
    {
      id: 'exception_fallback',
      label: 'exit, weak network, and local recovery have fallback state',
      passed: !!(dimensionMap.local_resilience && dimensionMap.local_resilience.ready)
    },
    {
      id: 'zero_help_trial',
      label: 'non-technical users can complete the simulated core scenarios without help',
      passed: userTrialSimulation.length > 0 && userTrialSimulation.every((item) => item.zeroHelpReady)
    },
    {
      id: 'no_local_p0',
      label: 'no known high-priority local code blocker remains',
      passed: localReady && moduleFlowMap.every((item) => item.status === 'closed')
    },
    {
      id: 'external_launch_config_clear',
      label: 'real launch configuration is complete',
      passed: !externalBlockers.some((item) => item.blockingLaunch)
    }
  ];
}

function buildLocalStretchBacklog(finalTargetGapMeter = {}) {
  const rows = Array.isArray(finalTargetGapMeter.rows) ? finalTargetGapMeter.rows : [];
  const rowMap = mapById(rows);
  return HIGH_LEVERAGE_LOCAL_STRETCH_BACKLOG.map((item) => {
    const related = rowMap[item.id]
      || (item.id === 'k12_content_system_scale' ? rowMap.curriculum_question_bank : null)
      || (item.id === 'ai_socratic_quality_eval' ? rowMap.socratic_tutor_depth : null)
      || (item.id === 'gizmo_level_daily_play' ? rowMap.active_recall_loop : null)
      || (item.id === 'parent_talent_decision_report' ? rowMap.parent_longitudinal_portrait : null)
      || (item.id === 'visual_first_step_blackboard' ? rowMap.visual_first_step_board : null)
      || (item.id === 'community_safe_share_relay' ? rowMap.wechat_safe_share_relay : null);
    const measuredPercent = Number((related && related.progress) || item.currentPercent || 0);
    const benchmarkPercent = Number(item.currentPercent || measuredPercent || 0);
    const currentPercent = Math.max(0, Math.min(100, Math.min(measuredPercent, benchmarkPercent)));
    return Object.assign({}, item, {
      currentPercent,
      remainingPercent: Math.max(0, Number(item.targetPercent || 100) - currentPercent),
      relatedTargetId: related ? related.id : '',
      relatedStatus: related ? related.status : 'stretch_not_measured',
      marginalValue: currentPercent >= 88 ? 'medium' : 'high'
    });
  }).filter((item) => item.remainingPercent > 0 && item.marginalValue !== 'low');
}

function buildIterationBoundary(gateChecklist, moduleFlowMap, pseudoFunctionScan, externalBlockers, finalTargetGapMeter = {}) {
  const localGateFailures = gateChecklist.filter((item) => !item.passed && item.id !== 'external_launch_config_clear');
  const brokenFlows = moduleFlowMap.filter((item) => item.status !== 'closed');
  const pseudoFunctions = pseudoFunctionScan.localPseudoFunctions || [];
  const externalLaunchBlockers = externalBlockers.filter((item) => item.blockingLaunch);
  const localStretchBacklog = buildLocalStretchBacklog(finalTargetGapMeter);
  const highValueStretchActions = localStretchBacklog.filter((item) => item.marginalValue !== 'low').map((item) => item.id);
  const localActions = localGateFailures.map((item) => item.id)
    .concat(brokenFlows.map((item) => item.id))
    .concat(pseudoFunctions.map((item) => item.id))
    .concat(highValueStretchActions);
  return {
    canContinueLocally: localActions.length > 0,
    localActions,
    stopReason: localActions.length
      ? (localGateFailures.length || brokenFlows.length || pseudoFunctions.length ? 'local_acceptance_gaps_remain' : 'high_leverage_local_stretch_until_external_boundary')
      : (externalLaunchBlockers.length ? 'local_acceptance_exhausted_external_config_required' : 'all_acceptance_gates_passed'),
    localStretchBacklog,
    externalBlockerIds: externalLaunchBlockers.map((item) => item.id)
  };
}

function buildAcceptanceReport(readiness = {}) {
  const dimensions = Array.isArray(readiness.dimensions) ? readiness.dimensions : [];
  const dimensionMap = mapById(dimensions);
  const localGaps = Array.isArray(readiness.gaps) ? readiness.gaps : [];
  const externalBlockers = Array.isArray(readiness.externalBlockers) ? readiness.externalBlockers : [];
  const aiUsageDecisionMatrix = readiness.aiUsageDecisionMatrix || buildAiUsageDecisionMatrix();
  const localReady = dimensions.length > 0 && localGaps.length === 0;
  const launchBlockedByExternalConfig = !!readiness.launchBlockedByExternalConfig;
  const verdict = localReady
    ? (launchBlockedByExternalConfig ? 'conditional_pass' : 'pass')
    : 'fail';

  const competitorBenchmark = BENCHMARK_CAPABILITIES.map((capability) => {
    const evidence = capability.dimensionIds
      .map((id) => dimensionMap[id])
      .filter(Boolean);
    const ready = evidence.length === capability.dimensionIds.length && evidence.every((item) => item.ready);
    return {
      id: capability.id,
      label: capability.label,
      status: readinessStatus(ready),
      evidence: evidence.flatMap((item) => item.evidence || []),
      gap: ready ? '' : 'missing local evidence for one or more required capability dimensions'
    };
  });

  const functionalityChecklist = dimensions.map((item) => ({
    id: item.id,
    name: item.label,
    status: item.ready ? 'implemented' : 'partial',
    evidence: item.evidence || [],
    fix: item.gap || ''
  }));
  const moduleFlowMap = MODULE_FLOW_CONTRACTS.map((contract) => buildContractStatus(contract, dimensionMap));
  const userTrialSimulation = USER_TRIAL_SCENARIOS.map((scenario) => buildUserTrialScenario(scenario, dimensionMap));
  const pseudoFunctionScan = buildPseudoFunctionScan(functionalityChecklist, externalBlockers);
  const competitiveMaturityDelta = MATURITY_AREAS.map((area) => buildMaturityDelta(area, dimensionMap, externalBlockers));
  const readinessGateChecklist = buildReadinessGateChecklist(
    localReady,
    moduleFlowMap,
    userTrialSimulation,
    pseudoFunctionScan,
    dimensions,
    externalBlockers
  );
  const finalTargetGapMeter = buildFinalTargetGapMeter(readiness, { moduleFlowMap });
  const competitiveMoatBoard = buildCompetitiveMoatBoard(readiness, finalTargetGapMeter);
  const iterationBoundary = buildIterationBoundary(
    readinessGateChecklist,
    moduleFlowMap,
    pseudoFunctionScan,
    externalBlockers,
    finalTargetGapMeter
  );

  const workflowBreakpoints = dimensions.map((item) => ({
    id: item.id,
    status: item.ready ? 'normal' : 'breakpoint',
    position: item.label,
    evidence: item.evidence || [],
    fix: item.ready ? '' : item.gap
  }));

  const technicalBreakpoints = dimensions.map((item) => ({
    id: item.id,
    risk: riskLevelFromReadiness(item),
    status: item.ready ? 'normal' : 'local_gap',
    description: item.ready
      ? `${item.id} has traceable local evidence`
      : `${item.id} lacks enough traceable local evidence`,
    fix: item.ready ? '' : item.gap
  })).concat(externalBlockers.map((item) => ({
    id: item.id,
    risk: item.blockingLaunch ? 'high_external' : 'medium_external',
    status: 'external_config_required',
    description: item.label,
    fix: 'configure outside this local code pass'
  })));

  const friendTrialRisk = localReady
    ? [{
      risk: launchBlockedByExternalConfig ? 'medium_external' : 'low',
      scenario: 'non-technical friend completes the local learning loop',
      description: 'local tutor, report, review, light practice, parent recap, and revisit loop have traceable evidence',
      mitigation: launchBlockedByExternalConfig ? 'use local/dev trial until external launch config is completed' : ''
    }]
    : localGaps.map((gap) => ({
      risk: gap.id === 'report_to_solution' || gap.id === 'guided_tutor' ? 'high' : 'medium',
      scenario: gap.label,
      description: 'friend may see a broken or shallow learning loop',
      mitigation: gap.fix
    }));

  const fixPriorityQueue = localGaps.map((gap) => ({
    priority: 'P0',
    owner: 'code',
    id: gap.id,
    action: gap.fix
  })).concat(externalBlockers.map((item) => ({
    priority: item.blockingLaunch ? 'P0_EXTERNAL' : 'P1_EXTERNAL',
    owner: item.owner || 'external_config',
    id: item.id,
    action: 'complete real service configuration before public launch'
  })));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    overallConclusion: verdict,
    localReadinessScore: Number(readiness.score || 0),
    friendTrialReady: !!readiness.friendTrialReady && localReady,
    commercialCodeReady: !!readiness.commercialCodeReady && localReady,
    launchBlockedByExternalConfig,
    competitiveGapSummary: competitorBenchmark,
    competitiveMaturityDelta,
    functionalityChecklist,
    storyLoop: Array.isArray(readiness.workflow) ? readiness.workflow : [],
    moduleFlowMap,
    userTrialSimulation,
    pseudoFunctionScan,
    readinessGateChecklist,
    iterationBoundary,
    finalTargetGapMeter,
    competitiveMoatBoard,
    aiUsageDecisionMatrix,
    workflowBreakpoints,
    technicalBreakpoints,
    friendTrialRisk,
    fixPriorityQueue,
    finalRecommendation: localReady
      ? 'keep_and_trial_after_external_config_boundary_is_clear'
      : 'fix_local_p0_before_friend_trial'
  };
}

function buildProductReadiness(storage, options = {}) {
  const todaySession = storage.getTodaySession ? storage.getTodaySession(options) : {};
  const todayFocus = storage.loadTodayFocus ? storage.loadTodayFocus() : null;
  const reportState = storage.loadLearningReportState ? storage.loadLearningReportState() : {};
  const tonightPlan = storage.loadTonightPlan ? storage.loadTonightPlan() : null;
  const reviewCards = storage.loadReviewCards ? storage.loadReviewCards() : [];
  const reviewEvents = storage.loadReviewEvents ? storage.loadReviewEvents() : [];
  const tutorEvents = storage.loadTutorEvents ? storage.loadTutorEvents() : [];
  const receipts = storage.loadThinkingReceipts ? storage.loadThinkingReceipts() : [];
  const gameProfile = storage.loadGameProfile ? storage.loadGameProfile() : {};
  const shareRuns = storage.loadShareRuns ? storage.loadShareRuns() : [];
  const incomingShare = storage.loadIncomingShare ? storage.loadIncomingShare() : null;
  const lightEvidence = storage.buildLightFeatureEvidenceSummary ? storage.buildLightFeatureEvidenceSummary(options) : null;
  const globalEvidence = storage.buildGlobalEvidenceBrief ? storage.buildGlobalEvidenceBrief(options) : null;
  const reviewLoop = storage.loadReviewLoop ? storage.loadReviewLoop() : {};
  const recent = storage.buildRecentLearningSummary ? storage.buildRecentLearningSummary(options.now || new Date()) : {};
  const sync = storage.syncDiagnostics ? storage.syncDiagnostics() : {};
  const analytics = storage.localAnalyticsDashboard ? storage.localAnalyticsDashboard() : {};
  const currentSession = storage.getTodaySession ? storage.getTodaySession({ now: options.now || new Date() }) : {};
  const depthMap = storage.buildLearningDepthMap ? storage.buildLearningDepthMap(options) : null;
  const weeklyPattern = storage.buildWeeklyPatternSynthesis ? storage.buildWeeklyPatternSynthesis(options) : null;
  const decisionPath = storage.buildLearningDecisionPath ? storage.buildLearningDecisionPath(options) : null;
  const masteryRubric = storage.buildMasteryRubric ? storage.buildMasteryRubric(options) : null;
  const interventionPlaybook = storage.buildInterventionPlaybook ? storage.buildInterventionPlaybook(options) : null;
  const outcomeReview = storage.buildOutcomeReviewSummary ? storage.buildOutcomeReviewSummary(options) : null;

  const tutorBlocked = tutorEvents.some((event) => /blocked|safety|answer/.test(`${event.type || ''}${event.name || ''}${event.mastery_status || ''}`))
    || receipts.some((receipt) => /answer shortcut blocked|blocked/i.test(`${receipt.status || ''}${receipt.title || ''}`));
  const diagnosticTutorEvidence = receipts.some((receipt) => receipt && (receipt.diagnostic_probe || receipt.transfer_prompt))
    || tutorEvents.some((event) => event && event.event === 'tutor_diagnostic_probe');
  const guidedEvidence = !!(
    todayFocus && (todayFocus.systemSuggestedStep || todayFocus.childArticulatedStep)
  ) || !!(
    currentSession && (currentSession.childArticulatedStep || currentSession.tutorCompleted || currentSession.taskTypeConfirmed)
  ) || tutorBlocked || diagnosticTutorEvidence;
  const reportConnected = !!(reportState.localLoopConnection && reportState.localLoopConnection.reportId);
  const cardsWithDue = reviewCards.filter((card) => card && (card.due || card.dueDate));
  const wrongCauseCards = reviewCards.filter((card) => card && (card.wrongCauseBucket || card.nextPracticePlan || card.repairPlan));
  const quizEvents = reviewEvents.filter((event) => /quiz|grade|revisit|review/.test(`${event.type || ''}`));
  const hasSevenDayPlan = !!(
    (tonightPlan && tonightPlan.reportSolution && count(tonightPlan.reportSolution.sevenDayPlan) >= 7)
    || (reportState.recommendationPlan && count(reportState.recommendationPlan.sevenDayPlan) >= 7)
  );
  const hasSyncDiagnostics = !!(
    sync
    && (
      Object.prototype.hasOwnProperty.call(sync, 'queueLength')
      || Object.prototype.hasOwnProperty.call(sync, 'pending')
      || Object.prototype.hasOwnProperty.call(sync, 'localSeq')
      || hasText(sync.label)
    )
  );

  const dimensions = [
    evidenceItem(
      'guided_tutor',
      '引导式作业点拨',
      guidedEvidence && (tutorBlocked || hasText(currentSession.childArticulatedStep) || hasText(todayFocus && todayFocus.systemSuggestedStep)),
      [
        todayFocus && todayFocus.systemSuggestedStep ? 'todayFocus.systemSuggestedStep' : '',
        currentSession.childArticulatedStep ? 'todaySession.childArticulatedStep' : '',
        diagnosticTutorEvidence ? 'tutor diagnostic probe or transfer prompt' : '',
        tutorBlocked ? 'tutor blocked direct-answer or safety shortcut' : ''
      ],
      '需要至少一次可追踪的第一步记录，并保留拒绝直接答案或安全转向证据。'
    ),
    evidenceItem(
      'report_to_solution',
      '测评/成绩单到方案承接',
      reportConnected && hasSevenDayPlan && !!(tonightPlan && tonightPlan.reportSolution),
      [
        reportConnected ? 'learningReport.localLoopConnection' : '',
        hasSevenDayPlan ? 'sevenDayPlan >= 7' : '',
        tonightPlan && tonightPlan.reportSolution ? 'tonightPlan.reportSolution' : ''
      ],
      '学习画像必须写入今晚路线、今日卡点、复习卡和 7 天游走方案。'
    ),
    evidenceItem(
      'material_to_review',
      '资料/错题变成复习资产',
      reviewCards.length > 0 && wrongCauseCards.length > 0,
      [
        `${reviewCards.length} reviewCards`,
        `${wrongCauseCards.length} wrong-cause cards`
      ],
      '需要真实生成可回访卡片，并保留错因/下一次检查点。'
    ),
    evidenceItem(
      'light_entry_evidence',
      '轻入口第一步证据',
      !!(lightEvidence && lightEvidence.ready && Number(lightEvidence.total || 0) > 0),
      [
        lightEvidence ? `light entries ${lightEvidence.total}` : '',
        lightEvidence ? `actionable ${lightEvidence.actionable}` : '',
        lightEvidence && lightEvidence.parentLine ? lightEvidence.parentLine : ''
      ],
      '口算、听写或手动选题必须留下可回到核心学习链路的第一步记录，并能在家长页汇总。'
    ),
    evidenceItem(
      'spaced_recall',
      '间隔复习和测验回流',
      cardsWithDue.length > 0 && (quizEvents.length > 0 || Number(reviewLoop.current_streak || 0) >= 0),
      [
        `${cardsWithDue.length} due cards`,
        quizEvents.length ? `${quizEvents.length} review events` : 'reviewLoop available'
      ],
      '复习卡必须有 due/dueDate，并能通过测验或评分事件回写。'
    ),
    evidenceItem(
      'game_retention',
      '轻练习留存证据',
      !!(todaySession.gamePlayed || Number(gameProfile.review_count || gameProfile.xp || 0) > 0),
      [
        todaySession.gamePlayed ? 'todaySession.gamePlayed' : '',
        Number(gameProfile.review_count || 0) ? `review_count ${gameProfile.review_count}` : '',
        Number(gameProfile.xp || 0) ? `xp ${gameProfile.xp}` : ''
      ],
      '小游戏必须写回学习记录，而不是只做装饰入口。'
    ),
    evidenceItem(
      'parent_evidence',
      '家长证据与 3/7 晚复盘',
      !!(todaySession.parentRecapViewed || count(recent.latest3) >= 1 || count(recent.latest7) >= 1),
      [
        todaySession.parentRecapViewed ? 'parentRecapViewed' : '',
        count(recent.latest3) ? `latest3 ${count(recent.latest3)}` : '',
        count(recent.latest7) ? `latest7 ${count(recent.latest7)}` : ''
      ],
      '家长侧必须能看到孩子第一步、专注、回访或轻练习的证据。'
    ),
    evidenceItem(
      'share_return',
      '家庭行动卡分享回流',
      !!(
        (shareRuns.length > 0 || incomingShare)
        && globalEvidence
        && (globalEvidence.latestRoute || globalEvidence.shareLine)
      ),
      [
        shareRuns.length ? `${shareRuns.length} share runs` : '',
        incomingShare ? 'incoming share stored' : '',
        globalEvidence && globalEvidence.shareLine ? globalEvidence.shareLine : '',
        globalEvidence && globalEvidence.latestRoute ? `route ${globalEvidence.latestRoute}` : ''
      ],
      '分享卡必须携带家长下一步、行动说明和回流入口，不能只是静态海报。'
    ),
    evidenceItem(
      'local_resilience',
      '本地恢复与服务边界',
      hasSyncDiagnostics && !!(analytics && Array.isArray(analytics.nodes)),
      [
        hasSyncDiagnostics ? 'syncDiagnostics.localQueue' : '',
        analytics && Array.isArray(analytics.nodes) ? 'localAnalyticsDashboard.nodes' : ''
      ],
      '弱网/未登录下必须有本地队列、备份或可诊断状态。'
    ),
    evidenceItem(
      'depth_compounding',
      '多层学习证据复利',
      !!(depthMap && Number(depthMap.depthScore || 0) >= 80 && Number(depthMap.readyCount || 0) >= 5),
      [
        depthMap ? `depthScore ${depthMap.depthScore}` : '',
        depthMap ? `readyDimensions ${depthMap.readyCount}/${depthMap.totalCount}` : '',
        depthMap && depthMap.nextBestAction ? `next: ${depthMap.nextBestAction}` : ''
      ],
      '需要追问、方案、回访、轻练、家长陪伴和回流至少 5 个维度有本地证据。'
    ),
    evidenceItem(
      'weekly_pattern',
      '一周模式归因',
      !!(weeklyPattern && weeklyPattern.ready),
      [
        weeklyPattern && weeklyPattern.summary ? weeklyPattern.summary : '',
        weeklyPattern && weeklyPattern.intervention ? weeklyPattern.intervention : ''
      ],
      '需要至少 3 晚或 3 张卡的真实记录，才能给出周模式判断。'
    ),
    evidenceItem(
      'decision_path',
      '下一步决策路径',
      !!(decisionPath && decisionPath.action && decisionPath.route),
      [
        decisionPath && decisionPath.action ? decisionPath.action : '',
        decisionPath && decisionPath.reason ? decisionPath.reason : ''
      ],
      '需要把当前证据转成一个明确的下一步入口和理由。'
    ),
    evidenceItem(
      'mastery_rubric',
      '掌握度分层',
      !!(masteryRubric && Number(masteryRubric.readyCount || 0) >= 3),
      [
        masteryRubric ? `stage ${masteryRubric.stage}` : '',
        masteryRubric ? `score ${masteryRubric.score}` : '',
        masteryRubric && masteryRubric.line ? masteryRubric.line : ''
      ],
      '需要第一步、错因、迁移、教家长或次日回访中至少 3 层证据。'
    ),
    evidenceItem(
      'intervention_playbook',
      '干预作战单',
      !!(interventionPlaybook && interventionPlaybook.ready && Array.isArray(interventionPlaybook.actions)),
      [
        interventionPlaybook && interventionPlaybook.summary ? interventionPlaybook.summary : '',
        interventionPlaybook && interventionPlaybook.masteryStage ? `mastery ${interventionPlaybook.masteryStage}` : ''
      ],
      '需要把周模式和掌握度转成今晚、回访、迁移、家长复述的动作单。'
    ),
    evidenceItem(
      'outcome_review',
      '结果复核',
      !!(outcomeReview && outcomeReview.ready),
      [
        outcomeReview && outcomeReview.line ? outcomeReview.line : ''
      ],
      '需要至少一次会解释、能迁移、隔天记得的结果复核记录。'
    )
  ];

  const externalBlockers = [
    {
      id: 'real_appid',
      label: '真实 AppID / 微信登录 / 合法域名',
      owner: 'external_config',
      blockingLaunch: true
    },
    {
      id: 'cloud_persistence',
      label: '跨设备云端持久化',
      owner: 'external_config',
      blockingLaunch: true
    },
    {
      id: 'production_ai_provider',
      label: '生产模型、API Key 与内容安全服务',
      owner: 'external_config',
      blockingLaunch: true
    },
    {
      id: 'payment',
      label: '支付与订阅',
      owner: 'external_config',
      blockingLaunch: false
    }
  ];

  const score = scoreFromItems(dimensions);
  const failed = dimensions.filter((item) => !item.ready);
  const aiUsageDecisionMatrix = buildAiUsageDecisionMatrix();
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    score,
    verdict: failed.length ? 'conditional' : 'local_ready',
    friendTrialReady: failed.length === 0,
    commercialCodeReady: failed.length === 0,
    launchBlockedByExternalConfig: externalBlockers.some((item) => item.blockingLaunch),
    dimensions,
    workflow: [
      'home_or_upload',
      'guided_tutor_first_step',
      'focus_cabin',
      'light_entry_evidence',
      'review_card',
      'light_practice_game',
      'parent_recap',
      'share_return',
      'next_day_revisit',
      'learning_report_solution',
      'learning_depth_map',
      'weekly_pattern',
      'next_best_action',
      'mastery_rubric',
      'intervention_playbook',
      'outcome_review'
    ],
    aiUsageDecisionMatrix,
    gaps: failed.map((item) => ({ id: item.id, label: item.label, fix: item.gap })),
    externalBlockers
  };
}

module.exports = {
  buildProductReadiness,
  buildAcceptanceReport,
  buildAiUsageDecisionMatrix,
  buildFinalTargetGapMeter,
  buildCompetitiveMoatBoard
};
