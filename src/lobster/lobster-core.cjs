'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const moduleCache = new Map();

function loadCommonJs(relativePath, requireMap = {}) {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const file = path.join(root, normalizedPath);
  const cacheKey = `${file}:${Object.keys(requireMap).join(',')}`;
  if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey);

  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  function localRequire(request) {
    if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
    if (request.startsWith('.')) {
      const resolved = path.resolve(path.dirname(file), request);
      const resolvedFile = fs.existsSync(resolved) ? resolved : `${resolved}.js`;
      return loadCommonJs(path.relative(root, resolvedFile).replace(/\\/g, '/'), requireMap);
    }
    return require(request);
  }

  const sandbox = {
    module,
    exports: module.exports,
    require: localRequire,
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp,
    JSON,
    Buffer,
    setTimeout,
    clearTimeout,
    wx: global.wx || {}
  };
  moduleCache.set(cacheKey, module.exports);
  vm.runInNewContext(code, sandbox, { filename: file });
  moduleCache.set(cacheKey, module.exports);
  return module.exports;
}

const tutorLadder = loadCommonJs('miniprogram/utils/tutor-ladder.js');
const learningReport = loadCommonJs('miniprogram/utils/learning-report.js');

const OPEN_SOURCE_REFERENCE_NOTES = [
  {
    id: 'openclaw',
    pattern: 'tool-and-channel-router',
    adopted: [
      'keep the lobster persona separate from capability tools',
      'make every capability callable through a small registry',
      'allow product shells to swap channels without changing education logic'
    ],
    notAdopted: [
      'no dependency on external bot framework',
      'no large runtime or plugin sandbox in the client bundle'
    ]
  },
  {
    id: 'hermes-style-agent',
    pattern: 'memory-plus-skills-agent',
    adopted: [
      'split child and parent agents by audience, memory, and release gates',
      'persist concise memory facts instead of raw full dialogue',
      'treat skills as explicit tools with guarded inputs and outputs'
    ],
    notAdopted: [
      'no unrestricted autonomous tool execution',
      'no unfiltered long-term transcript storage'
    ]
  },
  {
    id: 'open-maic-style-classroom',
    pattern: 'multi-agent-learning-scene-from-materials',
    adopted: [
      'turn parent material into executable learning scenes',
      'separate teacher, analyst, and reviewer capabilities',
      'make every generated learning action traceable to evidence'
    ],
    notAdopted: [
      'no classroom UI assumption',
      'no uncontrolled multi-agent debate before safety gates'
    ]
  }
];

const LOBSTER_CAPABILITY_CATALOG = {
  child: [
    { id: 'socratic_teacher_reply', label: 'Teacher-like Socratic reply', guardrails: ['no_final_answer', 'no_full_solution', 'child_can_continue'] },
    { id: 'homework_first_step_coach', label: 'Homework first-step coach', guardrails: ['no_answer_claim', 'first_step_only'] },
    { id: 'mini_lesson_bridge', label: 'Mini lesson bridge', guardrails: ['bounded_duration', 'must_return_to_child_action'] },
    { id: 'review_seed_from_tutor', label: 'Review seed from tutor', guardrails: ['no_score_reward', 'no_mastery_claim'] },
    { id: 'safe_memory_update', label: 'Safe child memory update', guardrails: ['no_full_dialogue', 'no_private_parent_data'] }
  ],
  parent: [
    { id: 'score_material_analysis', label: 'Score and material analysis', guardrails: ['no_ranking_marketing', 'no_guaranteed_improvement'] },
    { id: 'parent_decision_report', label: 'Parent decision report', guardrails: ['evidence_before_conclusion', 'parent_confirmation_required'] },
    { id: 'weekly_trend_brief', label: 'Weekly trend brief', guardrails: ['no_single_score_diagnosis', 'show_missing_fields'] },
    { id: 'evidence_gap_planner', label: 'Evidence gap planner', guardrails: ['collect_less_but_useful', 'no_sensitive_fields'] },
    { id: 'parent_script_generator', label: 'Parent low-pressure script', guardrails: ['no_pressure_language', 'no_extra_problem_load'] }
  ],
  shared: [
    { id: 'configuration_profile', label: 'Configurable lobster profile', guardrails: ['role_scoped_tools_only', 'safe_defaults'] },
    { id: 'safety_audit', label: 'Safety and privacy audit', guardrails: ['no_raw_transcript_public_payload', 'no_private_contact_fields'] }
  ]
};

const MODEL_ADAPTER_REFERENCE_NOTES = [
  {
    id: 'letta-memgpt-memory',
    pattern: 'persistent-agent-memory',
    adopted: ['store structured memory facts', 'keep memory model-agnostic', 'allow future product shells to load memory by lobster id'],
    notAdopted: ['no raw transcript archival', 'no self-editing memory without local safety rules']
  },
  {
    id: 'langgraph-autogen-routing',
    pattern: 'model-tool-routing',
    adopted: ['separate model prompt from capability execution', 'route child and parent roles through different guards'],
    notAdopted: ['no autonomous multi-agent loop without human-visible release gates']
  }
];

const PARENT_UNSAFE_RE = /保证|保分|必提|排名营销|超过同学|天赋差|智商低|学渣|公开排名|完整对话|原题照片|家长群|老师群|guaranteed|ranking/i;

const ROLE_CONFIGS = {
  child: {
    id: 'child_lobster',
    audience: 'child',
    displayName: '孩子龙虾',
    voice: '像耐心老师一样，只追问第一步，不直接给完整答案。',
    primaryTools: ['socratic_teacher_reply', 'homework_first_step_coach', 'mini_lesson_bridge', 'review_seed_from_tutor', 'safe_memory_update'],
    blockedDecisions: ['final_answer', 'mastery_claim', 'ranking_compare', 'reward_release', 'parent_private_judgment'],
    memoryPolicy: {
      keep: ['task_type', 'first_step_attempt', 'wrong_cause_guess', 'stuck_count', 'review_seed'],
      drop: ['full_answer', 'original_question_photo', 'full_dialogue', 'score', 'ranking']
    }
  },
  parent: {
    id: 'parent_lobster',
    audience: 'parent',
    displayName: '家长龙虾',
    voice: '像家庭学习顾问一样，接收成绩、错题和观察，输出证据优先的报告。',
    primaryTools: ['score_material_analysis', 'parent_decision_report', 'weekly_trend_brief', 'evidence_gap_planner', 'parent_script_generator'],
    blockedDecisions: ['guaranteed_improvement', 'talent_label', 'public_ranking', 'diagnosis_from_single_score'],
    memoryPolicy: {
      keep: ['score_subjects', 'parent_observation', 'priority_subjects', 'tonight_action', 'next_evidence'],
      drop: ['child_name', 'phone', 'wechat', 'full_dialogue', 'raw_private_comment']
    }
  }
};

function asText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  return JSON.stringify(value);
}

function normalizeRole(role) {
  const value = String(role || '').toLowerCase();
  if (value === 'parent' || value === 'guardian' || value === 'family') return 'parent';
  return 'child';
}

function listLobsterCapabilities(role = 'all') {
  if (role === 'all') {
    return LOBSTER_CAPABILITY_CATALOG.child
      .concat(LOBSTER_CAPABILITY_CATALOG.parent)
      .concat(LOBSTER_CAPABILITY_CATALOG.shared);
  }
  const normalized = normalizeRole(role);
  return (LOBSTER_CAPABILITY_CATALOG[normalized] || []).concat(LOBSTER_CAPABILITY_CATALOG.shared);
}

function buildCapabilityDeck(config = createLobsterConfig()) {
  const enabled = new Set(config.tools || []);
  return listLobsterCapabilities(config.audience).map((capability) => Object.assign({}, capability, {
    enabled: enabled.has(capability.id) || capability.id === 'configuration_profile' || capability.id === 'safety_audit'
  }));
}

function createLobsterConfig(input = {}) {
  const role = normalizeRole(input.role);
  const base = ROLE_CONFIGS[role];
  const allowedToolIds = new Set(listLobsterCapabilities(role).map((item) => item.id));
  const requestedTools = Array.isArray(input.tools) ? input.tools : [];
  const safeRequestedTools = requestedTools.filter((tool) => allowedToolIds.has(tool));
  return Object.assign({}, base, {
    displayName: input.displayName || base.displayName,
    subjectFocus: Array.isArray(input.subjectFocus) ? input.subjectFocus.slice(0, 8) : [],
    gradeBand: input.gradeBand || '',
    language: input.language || 'zh-CN',
    modelPolicy: Object.assign({
      mayUseServerModel: !!input.mayUseServerModel,
      localFirst: input.localFirst !== false,
      requireGuardedOutput: true
    }, input.modelPolicy || {}),
    tools: Array.from(new Set(base.primaryTools.concat(safeRequestedTools))),
    memoryPolicy: Object.assign({}, base.memoryPolicy, input.memoryPolicy || {})
  });
}

function createLobsterPair(input = {}) {
  return {
    productId: input.productId || 'lobster-learning-agents',
    child: createLobsterConfig(Object.assign({}, input.child || {}, { role: 'child' })),
    parent: createLobsterConfig(Object.assign({}, input.parent || {}, { role: 'parent' })),
    sharedBoundaries: {
      noFinalAnswerForChild: true,
      noScorePromiseForParent: true,
      noRawTranscriptSharing: true,
      evidenceBeforeConclusion: true
    },
    openSourceReferenceNotes: OPEN_SOURCE_REFERENCE_NOTES
  };
}

function configureLobsterPair(input = {}) {
  const pair = createLobsterPair(input);
  const warnings = [];
  ['child', 'parent'].forEach((role) => {
    const requested = input[role] && Array.isArray(input[role].tools) ? input[role].tools : [];
    const enabled = new Set(pair[role].tools || []);
    requested.forEach((tool) => {
      if (!enabled.has(tool)) warnings.push(`${role}:${tool}:not_allowed_for_role`);
    });
  });
  return Object.assign({}, pair, {
    capabilityDeck: {
      child: buildCapabilityDeck(pair.child),
      parent: buildCapabilityDeck(pair.parent),
      shared: LOBSTER_CAPABILITY_CATALOG.shared
    },
    warnings
  });
}

function buildMemorySummary(events = [], config = createLobsterConfig()) {
  const keep = new Set((config.memoryPolicy && config.memoryPolicy.keep) || []);
  const drop = new Set((config.memoryPolicy && config.memoryPolicy.drop) || []);
  const facts = [];
  const counters = {};

  (Array.isArray(events) ? events : []).forEach((event) => {
    const type = event && event.type ? String(event.type) : 'event';
    counters[type] = (counters[type] || 0) + 1;
    Object.keys(event || {}).forEach((key) => {
      if (drop.has(key) || /answer|photo|dialogue|phone|wechat|rank/i.test(key)) return;
      if (keep.has(key) || /first_step|wrong_cause|subject|score|observation|action|evidence/i.test(key)) {
        const text = asText(event[key]).slice(0, 160);
        if (text) facts.push({ key, text, sourceType: type });
      }
    });
  });

  return {
    role: config.audience,
    factCount: facts.length,
    facts: facts.slice(-12),
    counters,
    privacy: {
      rawDialogueStored: false,
      unsafeFieldsDropped: Array.from(drop)
    }
  };
}

function safeLobsterId(value, fallback = 'default') {
  return String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || fallback;
}

function lobsterMemoryPath(lobsterId, options = {}) {
  const baseDir = options.baseDir || path.join(root, 'outputs', 'lobster-memory');
  return path.join(baseDir, `${safeLobsterId(lobsterId)}.json`);
}

function loadLobsterMemory(lobsterId, options = {}) {
  const file = lobsterMemoryPath(lobsterId, options);
  if (!fs.existsSync(file)) {
    return {
      schema_id: 'lobster_memory_v1',
      lobsterId: safeLobsterId(lobsterId),
      facts: [],
      counters: {},
      updatedAt: ''
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Object.assign({
      schema_id: 'lobster_memory_v1',
      lobsterId: safeLobsterId(lobsterId),
      facts: [],
      counters: {},
      updatedAt: ''
    }, parsed || {});
  } catch (_) {
    return {
      schema_id: 'lobster_memory_v1',
      lobsterId: safeLobsterId(lobsterId),
      facts: [],
      counters: {},
      updatedAt: '',
      warning: 'memory_file_invalid'
    };
  }
}

function persistLobsterMemory(lobsterId, memoryUpdate = {}, options = {}) {
  const file = lobsterMemoryPath(lobsterId, options);
  const current = loadLobsterMemory(lobsterId, options);
  const facts = Array.isArray(memoryUpdate.facts) ? memoryUpdate.facts : [];
  const safeFacts = facts
    .filter((fact) => fact && fact.key && fact.text)
    .filter((fact) => !/answer|photo|dialogue|phone|wechat|rank|child_name/i.test(String(fact.key)))
    .map((fact) => ({
      key: String(fact.key).slice(0, 80),
      text: String(fact.text).slice(0, 220),
      sourceType: String(fact.sourceType || 'lobster').slice(0, 80),
      createdAt: fact.createdAt || new Date().toISOString()
    }));
  const counters = Object.assign({}, current.counters || {});
  Object.entries(memoryUpdate.counters || {}).forEach(([key, value]) => {
    counters[key] = Number(counters[key] || 0) + Number(value || 0);
  });
  const next = {
    schema_id: 'lobster_memory_v1',
    lobsterId: safeLobsterId(lobsterId),
    role: memoryUpdate.role || current.role || '',
    facts: (current.facts || []).concat(safeFacts).slice(-80),
    counters,
    privacy: {
      rawDialogueStored: false,
      unsafeFieldsDropped: (memoryUpdate.privacy && memoryUpdate.privacy.unsafeFieldsDropped) || []
    },
    updatedAt: new Date().toISOString()
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return {
    ok: true,
    memoryPath: file,
    factCount: next.facts.length,
    memory: next
  };
}

function buildModelPrompt(input = {}, config = createLobsterConfig()) {
  const role = config.audience || normalizeRole(input.role);
  const memory = input.memory || {};
  const facts = Array.isArray(memory.facts) ? memory.facts.slice(-8).map((fact) => `${fact.key}: ${fact.text}`) : [];
  return {
    role,
    system: role === 'parent'
      ? 'You are Parent Lobster. Use evidence-first education guidance. Never promise score improvement, rank marketing, or fixed talent labels.'
      : 'You are Child Lobster. Reply like a patient teacher. Ask for the first step. Never give final answers or complete solutions.',
    user: asText(input.message || input.text || input.materialText),
    memoryFacts: facts,
    allowedTools: config.tools || [],
    blockedDecisions: config.blockedDecisions || []
  };
}

function guardParentModelReply(reply, fallbackReport = {}, config = createLobsterConfig({ role: 'parent' })) {
  const text = asText(reply && (reply.reply || reply.text || reply.summary || reply));
  if (!text || PARENT_UNSAFE_RE.test(text)) {
    return {
      reply: fallbackReport.summary && fallbackReport.summary.oneSentenceDecision
        ? fallbackReport.summary.oneSentenceDecision
        : '先确认证据，再给今晚一个低压动作；不承诺提分，不做排名比较。',
      model_guard: {
        status: 'replaced_with_parent_safe_report_line',
        reasons: !text ? ['empty_reply'] : ['unsafe_parent_claim'],
        blockedDecisions: config.blockedDecisions || []
      }
    };
  }
  return {
    reply: text,
    model_guard: {
      status: 'accepted_parent_rewrite',
      reasons: [],
      blockedDecisions: config.blockedDecisions || []
    }
  };
}

async function runLobsterModelAdapter(input = {}, adapter = null) {
  const role = normalizeRole(input.role || input.audience);
  const config = createLobsterConfig(Object.assign({}, input.config || {}, { role }));
  const memory = input.memory || loadLobsterMemory(input.lobsterId || config.id, input.memoryOptions || {});
  const prompt = buildModelPrompt(Object.assign({}, input, { memory }), config);
  const modelReply = adapter ? await adapter(prompt) : null;

  if (role === 'parent') {
    const fallbackReport = buildParentLobsterReport(Object.assign({}, input, { config }));
    const guarded = guardParentModelReply(modelReply, fallbackReport, config);
    return Object.assign({}, fallbackReport, {
      reply: guarded.reply,
      modelPrompt: prompt,
      modelGuard: guarded.model_guard,
      modelAdapterUsed: Boolean(adapter)
    });
  }

  const fallbackChild = buildChildLobsterReply(Object.assign({}, input, { config }));
  if (!modelReply) {
    return Object.assign({}, fallbackChild, {
      modelPrompt: prompt,
      modelGuard: { status: 'local_fallback_no_adapter' },
      modelAdapterUsed: false
    });
  }
  const guarded = tutorLadder.guardAiTutorReply(
    modelReply,
    fallbackChild.raw && fallbackChild.raw.contract ? fallbackChild.raw.contract : {},
    {
      localFallback: fallbackChild.raw && fallbackChild.raw.localTutor ? fallbackChild.raw.localTutor : fallbackChild,
      pressureSignal: fallbackChild.raw && fallbackChild.raw.localTutor ? fallbackChild.raw.localTutor.real_homework_pressure_signal || {} : {}
    }
  );
  return Object.assign({}, fallbackChild, {
    reply: guarded.reply,
    modelPrompt: prompt,
    modelGuard: guarded.ai_guard || { status: 'accepted_ai_rewrite' },
    modelAdapterUsed: true
  });
}

function buildMiniLessonBridge(input = {}, childReply = null) {
  const reply = childReply || buildChildLobsterReply(input);
  const taskType = input.taskType || (reply.raw && reply.raw.localTutor && reply.raw.localTutor.task_type) || 'unknown';
  const signal = (reply.raw && reply.raw.localTutor && reply.raw.localTutor.real_homework_pressure_signal) || {};
  const fallbackPlan = tutorLadder.buildSocraticFallbackPlan
    ? tutorLadder.buildSocraticFallbackPlan(taskType, signal, null, { answerBlocked: !!reply.reviewSeed })
    : null;
  return {
    capabilityId: 'mini_lesson_bridge',
    audience: 'child',
    status: 'ready',
    miniLesson: {
      title: 'Short bridge before returning to the first step',
      childLine: reply.reply,
      exitTicket: signal.parentCheck || 'Say the first step in one sentence before doing the full problem.',
      returnAction: signal.reviewMove || 'Make one near-transfer review card tomorrow.',
      fallbackMode: fallbackPlan && fallbackPlan.mode
    },
    safety: {
      noFinalAnswer: true,
      reviewSeedRequired: Boolean(reply.reviewSeed)
    }
  };
}

function buildParentScript(report = {}, input = {}) {
  const action = report.summary && Array.isArray(report.summary.tonightAction)
    ? report.summary.tonightAction.filter(Boolean)
    : [];
  return {
    capabilityId: 'parent_script_generator',
    audience: 'parent',
    status: 'ready',
    script: {
      canSay: action.length ? action.slice(0, 3) : ['Tell me the first step you would try. One sentence is enough.'],
      dontSay: ['Do not ask for the full answer first.', 'Do not compare rankings or promise score gains.'],
      tomorrowCheck: report.summary && report.summary.nextEvidence && report.summary.nextEvidence[0]
        ? asText(report.summary.nextEvidence[0])
        : 'Tomorrow, check whether the child can restate the first step and one wrong-cause guess.'
    },
    safety: {
      noPressureLanguage: true,
      noExtraProblemLoad: true,
      source: input.sourceType || report.materialType || 'parent_report'
    }
  };
}

function buildEvidenceGapPlan(report = {}) {
  const nextEvidence = (report.summary && report.summary.nextEvidence) || [];
  return {
    capabilityId: 'evidence_gap_planner',
    audience: 'parent',
    status: 'ready',
    gaps: nextEvidence.length ? nextEvidence : [
      { id: 'first_step_sample', action: 'Collect one child-owned first-step attempt.' },
      { id: 'wrong_cause_guess', action: 'Collect one wrong-cause guess in the child words.' },
      { id: 'next_day_revisit', action: 'Check one near-transfer item tomorrow.' }
    ],
    safety: {
      noSensitiveFields: true,
      collectLessButUseful: true
    }
  };
}

function buildWeeklyTrendBrief(report = {}, input = {}) {
  const subjects = (report.summary && report.summary.parsedScoreSubjects) || [];
  return {
    capabilityId: 'weekly_trend_brief',
    audience: 'parent',
    status: 'ready',
    trend: {
      prioritySubjects: subjects.slice(0, 4),
      summaryLine: subjects.length
        ? `Use confirmed score subjects only: ${subjects.join(', ')}.`
        : 'No confirmed score subjects yet; ask for one score sheet or one wrong-question sample.',
      followupQuestions: [
        'Which subject has the clearest recent evidence?',
        'Where did the child get stuck before the answer?',
        'What can be checked tomorrow without adding pressure?'
      ],
      recordCount: Array.isArray(input.scoreRecords) ? input.scoreRecords.length : 0
    },
    safety: {
      noSingleScoreDiagnosis: true,
      showMissingFields: true
    }
  };
}

function runLobsterCapability(input = {}) {
  const capabilityId = String(input.capabilityId || input.capability || '').trim();
  const role = normalizeRole(input.role || input.audience || (capabilityId.indexOf('parent') >= 0 || capabilityId.indexOf('score') >= 0 ? 'parent' : 'child'));
  const config = createLobsterConfig(Object.assign({}, input.config || {}, { role }));
  const enabled = new Set(config.tools || []);
  const shared = new Set(LOBSTER_CAPABILITY_CATALOG.shared.map((item) => item.id));
  if (capabilityId && !enabled.has(capabilityId) && !shared.has(capabilityId)) {
    return {
      ok: false,
      error: 'capability_not_enabled',
      role,
      capabilityId,
      enabledTools: config.tools
    };
  }

  if (role === 'parent') {
    const report = buildParentLobsterReport(Object.assign({}, input, { config }));
    if (capabilityId === 'weekly_trend_brief') return Object.assign({ ok: true }, buildWeeklyTrendBrief(report, input));
    if (capabilityId === 'evidence_gap_planner') return Object.assign({ ok: true }, buildEvidenceGapPlan(report, input));
    if (capabilityId === 'parent_script_generator') return Object.assign({ ok: true }, buildParentScript(report, input));
    return Object.assign({ ok: true, capabilityId: capabilityId || 'parent_decision_report' }, report);
  }

  const childReply = buildChildLobsterReply(Object.assign({}, input, { config }));
  if (capabilityId === 'mini_lesson_bridge') return Object.assign({ ok: true }, buildMiniLessonBridge(input, childReply));
  if (capabilityId === 'review_seed_from_tutor') {
    return {
      ok: true,
      capabilityId: 'review_seed_from_tutor',
      audience: 'child',
      reviewSeed: childReply.reviewSeed || {
        source: 'lobster_first_step',
        revisit: 'Tomorrow, repeat the first step with one changed number or context.'
      },
      safety: childReply.safety
    };
  }
  return Object.assign({ ok: true, capabilityId: capabilityId || 'socratic_teacher_reply' }, childReply);
}

async function runLobsterFamilySession(input = {}, adapter = null) {
  const pair = configureLobsterPair(input.config || input);
  const childInput = Object.assign({}, input.childMessage || {}, {
    role: 'child',
    config: pair.child,
    lobsterId: input.childLobsterId || pair.child.id,
    memoryOptions: input.memoryOptions || {}
  });
  const parentInput = Object.assign({}, input.parentMaterial || {}, {
    role: 'parent',
    config: pair.parent,
    lobsterId: input.parentLobsterId || pair.parent.id,
    memoryOptions: input.memoryOptions || {}
  });
  const child = childInput.message || childInput.text
    ? await runLobsterModelAdapter(childInput, adapter)
    : null;
  const parent = parentInput.message || parentInput.text || parentInput.materialText
    ? await runLobsterModelAdapter(parentInput, adapter)
    : null;
  const memoryReceipts = {};
  if (input.persistMemory) {
    if (child && child.memoryUpdate) {
      memoryReceipts.child = persistLobsterMemory(childInput.lobsterId, child.memoryUpdate, input.memoryOptions || {});
    }
    if (parent && parent.memoryUpdate) {
      memoryReceipts.parent = persistLobsterMemory(parentInput.lobsterId, parent.memoryUpdate, input.memoryOptions || {});
    }
  }
  const handoff = {
    schema_id: 'lobster_family_handoff_v1',
    childAction: child && child.reply ? child.reply : '',
    parentDecision: parent && parent.summary ? parent.summary.oneSentenceDecision : '',
    nextEvidence: parent && parent.summary ? parent.summary.nextEvidence : [],
    reviewSeedReady: Boolean(child && child.reviewSeed),
    safetyLine: 'Child Lobster stays first-step only; Parent Lobster stays evidence-first with no score promise.',
    sharedBoundaries: pair.sharedBoundaries
  };
  return {
    ok: true,
    schema_id: 'lobster_family_session_v1',
    productId: pair.productId,
    config: {
      child: pair.child,
      parent: pair.parent,
      warnings: pair.warnings
    },
    child,
    parent,
    handoff,
    memoryReceipts: {
      child: memoryReceipts.child ? { ok: memoryReceipts.child.ok, factCount: memoryReceipts.child.factCount } : null,
      parent: memoryReceipts.parent ? { ok: memoryReceipts.parent.ok, factCount: memoryReceipts.parent.factCount } : null
    }
  };
}

function detectParentMaterialType(text) {
  if (/成绩|分数|排名|语文|数学|英语|物理|化学|score|rank/i.test(text)) return 'score_sheet';
  if (/错题|不会|卡住|第一步|订正/i.test(text)) return 'wrong_question_paper';
  return 'parent_report';
}

function buildChildLobsterReply(input = {}) {
  const config = createLobsterConfig(Object.assign({}, input.config || {}, { role: 'child' }));
  const message = asText(input.message || input.text);
  const selected = Object.assign({
    taskType: input.taskType || '',
    weakPoint: input.weakPoint || input.subject || ''
  }, input.selected || {});
  const localReply = tutorLadder.buildTutorReply(message, {
    selected,
    messages: Array.isArray(input.messages) ? input.messages : [],
    currentHintLevel: input.currentHintLevel || 1
  });
  const contract = tutorLadder.buildSocraticAiLocalBoundaryContract(
    localReply.task_type || selected.taskType || 'unknown',
    localReply.real_homework_pressure_signal || {}
  );
  const guarded = tutorLadder.guardAiTutorReply(
    input.aiReply || { reply: localReply.reply },
    contract,
    {
      localFallback: localReply,
      pressureSignal: localReply.real_homework_pressure_signal || {}
    }
  );

  return {
    lobsterId: config.id,
    audience: 'child',
    displayName: config.displayName,
    reply: guarded.reply,
    teacherMode: {
      style: 'socratic_first_step',
      noFinalAnswer: true,
      allowedMoves: localReply.allowed_moves || [],
      hintLevel: localReply.hint_level || 1
    },
    capabilitiesUsed: ['socratic_teacher_reply', localReply.answer_boundary_evidence ? 'review_seed_from_tutor' : 'safe_memory_update'],
    safety: {
      guardStatus: guarded.ai_guard && guarded.ai_guard.status,
      blockedDecisions: config.blockedDecisions,
      answerBoundaryEvidence: guarded.answer_boundary_evidence || localReply.answer_boundary_evidence || null
    },
    reviewSeed: (guarded.answer_boundary_evidence && guarded.answer_boundary_evidence.reviewSeed)
      || (localReply.answer_boundary_evidence && localReply.answer_boundary_evidence.reviewSeed)
      || null,
    memoryUpdate: buildMemorySummary([
      {
        type: 'child_message',
        task_type: localReply.task_type || selected.taskType || 'unknown',
        first_step_attempt: message,
        wrong_cause_guess: localReply.real_homework_pressure_signal && localReply.real_homework_pressure_signal.wrongCause,
        review_seed: localReply.answer_boundary_evidence && localReply.answer_boundary_evidence.reviewSeed
      }
    ], config),
    raw: {
      localTutor: localReply,
      contract
    }
  };
}

function buildParentLobsterReport(input = {}) {
  const config = createLobsterConfig(Object.assign({}, input.config || {}, { role: 'parent' }));
  const text = asText(input.materialText || input.message || input.text);
  const sourceType = input.sourceType || detectParentMaterialType(text);
  const reportState = learningReport.buildLearningReportDraft({
    sourceText: text,
    scoreText: sourceType === 'score_sheet' ? text : '',
    materialType: sourceType,
    sourceType,
    parentObservation: input.parentObservation || text,
    reportSources: [
      {
        type: sourceType,
        sourceSchemaId: sourceType,
        label: sourceType === 'score_sheet' ? '成绩单/阶段成绩' : '家长输入',
        text,
        status: 'parent_lobster_input_requires_confirmation'
      }
    ],
    scoreRecords: Array.isArray(input.scoreRecords) ? input.scoreRecords : []
  });
  const draft = reportState.reportDraft || {};
  const parentBook = draft.parentDecisionBook || reportState.parentDecisionBook || {};
  const personalizedPreview = reportState.personalizedParentReportPreview || draft.personalizedParentReportPreview || null;
  const parsedScores = reportState.parsedScores || draft.parsedScores || {};

  return {
    lobsterId: config.id,
    audience: 'parent',
    displayName: config.displayName,
    materialType: sourceType,
    summary: {
      title: parentBook.title || '家长龙虾学习分析报告',
      oneSentenceDecision: parentBook.oneSentenceDecision || draft.tonightDecisionHeadline || '先确认证据，再给今晚一个低压动作。',
      tonightAction: parentBook.tonightDo || [draft.tonightDecisionBrief && draft.tonightDecisionBrief.parentScript].filter(Boolean),
      nextEvidence: parentBook.nextEvidenceQueue || [],
      parsedScoreSubjects: Object.keys(parsedScores)
    },
    capabilitiesUsed: ['score_material_analysis', 'parent_decision_report', 'evidence_gap_planner', 'parent_script_generator'],
    report: {
      parentDecisionBook: parentBook,
      familyLearningDecisionReport: reportState.familyLearningDecisionReport || draft.familyLearningDecisionReport || null,
      personalizedParentReportPreview: personalizedPreview
        ? {
            format: personalizedPreview.format,
            standardVersion: personalizedPreview.standard && personalizedPreview.standard.version,
            htmlBytes: personalizedPreview.html ? Buffer.byteLength(personalizedPreview.html, 'utf8') : 0
          }
        : null
    },
    safety: {
      blockedDecisions: config.blockedDecisions,
      noGuaranteedImprovement: true,
      noPublicRanking: true,
      requiresParentConfirmation: true
    },
    memoryUpdate: buildMemorySummary([
      {
        type: 'parent_material',
        score_subjects: Object.keys(parsedScores).join(','),
        parent_observation: input.parentObservation || text.slice(0, 180),
        priority_subjects: parentBook.prioritySubjects || [],
        tonight_action: parentBook.tonightDo || [],
        next_evidence: parentBook.nextEvidenceQueue || []
      }
    ], config),
    raw: {
      reportState
    }
  };
}

function routeLobsterMessage(input = {}) {
  const role = normalizeRole(input.role || (input.audience));
  if (role === 'parent') return buildParentLobsterReport(input);
  return buildChildLobsterReply(input);
}

function buildLobsterProductPlan() {
  return {
    name: 'Lobster Learning Agents',
    goal: 'one child-facing teacher lobster and one parent-facing analyst lobster, both powered by existing Yuandian learning evidence engines',
    phases: [
      {
        id: 'core',
        status: 'implemented_here',
        deliverables: ['role configs', 'tool registry contract', 'child tutor reply', 'parent report analysis', 'safe memory summaries']
      },
      {
        id: 'service-api',
        status: 'next',
        deliverables: ['POST /api/lobster/message', 'POST /api/lobster/config', 'server model adapter with guardAiTutorReply']
      },
      {
        id: 'product-shell',
        status: 'next',
        deliverables: ['independent web or chat shell', 'parent/child account separation', 'memory management UI']
      }
    ],
    openSourceReferenceNotes: OPEN_SOURCE_REFERENCE_NOTES
  };
}

module.exports = {
  OPEN_SOURCE_REFERENCE_NOTES,
  MODEL_ADAPTER_REFERENCE_NOTES,
  LOBSTER_CAPABILITY_CATALOG,
  ROLE_CONFIGS,
  createLobsterConfig,
  createLobsterPair,
  configureLobsterPair,
  listLobsterCapabilities,
  buildCapabilityDeck,
  buildMemorySummary,
  loadLobsterMemory,
  persistLobsterMemory,
  buildModelPrompt,
  guardParentModelReply,
  runLobsterModelAdapter,
  runLobsterCapability,
  runLobsterFamilySession,
  buildChildLobsterReply,
  buildParentLobsterReport,
  routeLobsterMessage,
  buildLobsterProductPlan
};
