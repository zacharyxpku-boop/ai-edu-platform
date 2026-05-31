export const config = { runtime: 'edge' };

const PROVIDERS = {
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    env: ['DEEPSEEK_KEY', 'DEEPSEEK_API_KEY'],
    model: 'deepseek-chat'
  },
  qwen: {
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    env: ['QWEN_KEY', 'DASHSCOPE_API_KEY'],
    model: 'qwen-plus'
  }
};

const BLOCKED_FIELDS = [
  'talent_label',
  'personality_label',
  'auto_grading',
  'ocr_claim',
  'full_answer',
  'ranking',
  'guaranteed_improvement',
  'diagnosis_label',
  'reward_release'
];

const RESPONSE_SCHEMA = {
  source_type: 'parent_report | talent_assessment | score_sheet | wrong_question_paper | school_material',
  subject: 'math | chinese | english | physics | chemistry | biology | geography | unknown',
  wrongCause: 'candidate wrong-cause, never a fixed diagnosis',
  firstStep: 'one learner-owned first step, not a full answer',
  learningPreference: 'method hypothesis that must be validated by real homework',
  evidenceConfidence: {
    level: 'low | medium | high',
    reason: 'what evidence supports this draft',
    required_next_evidence: []
  },
  analysisQuality: {
    status: 'fallback_or_manual_confirm | draft_can_enter_local_execution',
    score: 0,
    missingEvidence: [],
    releaseRule: 'local code controls all release gates'
  },
  nextAction: {
    label: 'what the family should do next',
    route: '/pages/tutor/tutor?from=ai_material_analysis',
    owner: 'local_code | ai_with_local_guardrail',
    evidence_gate: 'manual_confirmation_required'
  },
  executionPath: {
    socraticRoute: '/pages/tutor/tutor?from=ai_material_analysis',
    miniLessonRoute: '/pages/tutor/tutor?from=ai_material_analysis_mini_lesson',
    gameRecallRoute: '/pages/review/review?from=ai_material_analysis',
    parentReviewRoute: '/pages/profile/profile?from=ai_material_analysis'
  },
  student_profile_signals: {},
  score_signals: {},
  wrong_question_signals: {},
  learning_method_candidates: [],
  socratic_next_questions: [],
  recommended_product_loop: {},
  family_solution_book: {},
  risk_flags: [],
  blocked_claims: [],
  manual_confirmation_fields: []
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function firstEnv(names) {
  if (typeof process === 'undefined' || !process.env) return '';
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return '';
}

function extractJson(text) {
  const value = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(value);
  } catch (_) {}
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

function safeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  return String(value).split(/[,\n;；、]+/).map((item) => item.trim()).filter(Boolean);
}

function safeText(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function buildExecutionPath(raw, sourceType) {
  const path = raw.executionPath || raw.execution_path || {};
  const baseFrom = sourceType === 'talent_assessment' ? 'ai_material_method_validation' : 'ai_material_analysis';
  return {
    socraticRoute: safeText(path.socraticRoute || path.socratic_route, `/pages/tutor/tutor?from=${baseFrom}`),
    miniLessonRoute: safeText(path.miniLessonRoute || path.mini_lesson_route, '/pages/tutor/tutor?from=ai_material_analysis_mini_lesson'),
    gameRecallRoute: safeText(path.gameRecallRoute || path.game_recall_route, '/pages/review/review?from=ai_material_analysis'),
    parentReviewRoute: safeText(path.parentReviewRoute || path.parent_review_route, '/pages/profile/profile?from=ai_material_analysis')
  };
}

function buildAnalysisQualityGate(candidate, blockedClaims) {
  const evidence = candidate.evidenceConfidence || candidate.evidence_confidence || {};
  const required = safeList(evidence.required_next_evidence || evidence.requiredNextEvidence);
  const hasSubject = !!String(candidate.subject || '').trim();
  const hasFirstStep = !!String(candidate.firstStep || candidate.first_step || '').trim();
  const hasWrongCause = !!String(candidate.wrongCause || candidate.wrong_cause || '').trim();
  const confidenceLevel = String(evidence.level || '').toLowerCase();
  const blocked = Array.isArray(blockedClaims) ? blockedClaims : [];
  const missingEvidence = [];
  if (!hasSubject) missingEvidence.push('subject');
  if (!hasFirstStep) missingEvidence.push('first_step');
  if (!hasWrongCause) missingEvidence.push('wrong_cause');
  if (!required.length) missingEvidence.push('required_next_evidence');
  if (confidenceLevel === 'low') missingEvidence.push('stronger_evidence');
  const score = Math.max(0, Math.min(100,
    (hasSubject ? 20 : 0)
    + (hasFirstStep ? 25 : 0)
    + (hasWrongCause ? 25 : 0)
    + (required.length ? 15 : 0)
    + (!blocked.length ? 15 : 0)
  ));
  return {
    id: 'ai_material_analysis_quality_gate',
    status: blocked.length || missingEvidence.length ? 'fallback_or_manual_confirm' : 'draft_can_enter_local_execution',
    score,
    missingEvidence,
    blockedClaims: blocked,
    fallbackRoute: '/pages/tutor/tutor?from=ai_material_quality_fallback',
    releaseRule: 'local code releases only first-step, wrong-cause, next-day revisit, and parent-confirmed actions'
  };
}

function sanitizeResult(raw, sourceType) {
  const serialized = JSON.stringify(raw || {});
  const blocked = BLOCKED_FIELDS.filter((field) => {
    return Object.prototype.hasOwnProperty.call(raw || {}, field)
      || serialized.toLowerCase().includes(field)
      || /完整答案|自动判分|OCR|排名|保证提升|诊断为|天赋定性/.test(serialized);
  });
  const normalizedSourceType = raw.source_type || sourceType || 'parent_report';
  const executionPath = buildExecutionPath(raw, normalizedSourceType);
  const evidenceConfidence = raw.evidenceConfidence || raw.evidence_confidence || {};
  const nextAction = raw.nextAction || raw.next_action || {};
  const firstStep = safeText(raw.firstStep || raw.first_step, 'Ask the learner to state only the first step and stop before the full answer.');
  const wrongCause = safeText(raw.wrongCause || raw.wrong_cause, 'wrong-cause candidate pending one real homework check');
  const blockedClaims = Array.from(new Set(safeList(raw.blockedClaims).concat(safeList(raw.blocked_claims)).concat(blocked)));
  const analysisQuality = buildAnalysisQualityGate(Object.assign({}, raw, {
    firstStep,
    wrongCause,
    evidenceConfidence
  }), blockedClaims);
  return {
    source_type: normalizedSourceType,
    subject: safeText(raw.subject, 'unknown'),
    wrongCause,
    firstStep,
    learningPreference: safeText(raw.learningPreference || raw.learning_preference, normalizedSourceType === 'talent_assessment'
      ? 'method hypothesis only; validate with one real wrong question and day-7 variant'
      : 'start with first-step Socratic validation, then release practice only after evidence'),
    evidenceConfidence: {
      level: safeText(evidenceConfidence.level, 'low'),
      reason: safeText(evidenceConfidence.reason, 'manual confirmation and structured evidence are required before release'),
      required_next_evidence: safeList(evidenceConfidence.required_next_evidence || evidenceConfidence.requiredNextEvidence).slice(0, 4)
    },
    analysisQuality,
    nextAction: {
      label: safeText(nextAction.label, firstStep),
      route: safeText(nextAction.route, executionPath.socraticRoute),
      owner: safeText(nextAction.owner, 'ai_with_local_guardrail'),
      evidence_gate: safeText(nextAction.evidence_gate || nextAction.evidenceGate, 'parent_manual_confirmation')
    },
    executionPath,
    student_profile_signals: raw.student_profile_signals || {},
    score_signals: raw.score_signals || {},
    wrong_question_signals: raw.wrong_question_signals || {},
    learning_method_candidates: safeList(raw.learning_method_candidates).slice(0, 4),
    socratic_next_questions: safeList(raw.socratic_next_questions).slice(0, 3),
    recommended_product_loop: raw.recommended_product_loop || {},
    family_solution_book: raw.family_solution_book || {},
    risk_flags: Array.from(new Set(safeList(raw.risk_flags).concat(blocked))),
    blocked_claims: blockedClaims,
    manual_confirmation_fields: Array.from(new Set(safeList(raw.manual_confirmation_fields).concat([
      'source_text_excerpt',
      'structured_evidence',
      'parent_confirmation'
    ]))),
    local_release_gate: sourceType === 'talent_assessment'
      ? 'talent_report_requires_real_wrong_question_and_day7_variant'
      : 'material_analysis_requires_structured_evidence_and_parent_confirmation',
    blockedClaims
  };
}

function buildPrompt(body) {
  return [
    {
      role: 'system',
      content: [
        'You are an AI education material analysis service for a WeChat mini program.',
        'Return strict JSON only. Do not include markdown.',
        'You may draft summaries, Socratic questions, method candidates, and a family solution book.',
        'You must fill normalized fields: subject, wrongCause, firstStep, learningPreference, evidenceConfidence, analysisQuality, nextAction, blockedClaims, and executionPath.',
        'Every nextAction must route into the product execution path: Socratic tutor, mini lesson, game recall only after evidence, and parent review.',
        'You must not produce talent labels, personality labels, OCR claims, auto grading, full answers, rankings, diagnosis labels, reward release, or guaranteed improvement.',
        'Treat dermatoglyphic or talent reports only as learning method hypotheses that need real homework validation.',
        'Treat score sheets only as private parent priority signals; never use scores for rewards, rankings, share payloads, or guaranteed improvement.',
        'Required JSON schema:',
        JSON.stringify(RESPONSE_SCHEMA)
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        source_schema_id: body.source_schema_id,
        source_schema_label: body.source_schema_label,
        source_text_excerpt: String(body.source_text_excerpt || '').slice(0, 1200),
        structured_evidence: body.structured_evidence || {},
        grade: body.grade || '',
        subject: body.subject || '',
        confirmed_scores: body.confirmed_scores || null,
        parent_observation: body.parent_observation || '',
        output_focus: [
          'one_page_diagnosis',
          'method_candidates',
          'seven_day_action',
          'parent_script',
          'review_evidence',
          'next_service_suggestion',
          'normalized_solution_fields',
          'product_execution_path',
          'strict JSON'
        ]
      })
    }
  ];
}

async function callProvider(provider, key, messages) {
  const cfg = PROVIDERS[provider];
  const response = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + key
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: 0.2,
      max_tokens: 1200,
      response_format: provider === 'deepseek' ? { type: 'json_object' } : undefined
    })
  });
  if (!response.ok) {
    throw new Error(`upstream_${provider}_${response.status}`);
  }
  const data = await response.json();
  return data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type'
      }
    });
  }
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return json(400, { error: 'bad_json' });
  }

  const sourceType = body.source_schema_id || 'parent_report';
  const messages = buildPrompt(body);
  const providerOrder = ['deepseek', 'qwen'];
  for (const provider of providerOrder) {
    const key = firstEnv(PROVIDERS[provider].env);
    if (!key) continue;
    try {
      const text = await callProvider(provider, key, messages);
      const parsed = extractJson(text);
      if (!parsed) return json(502, { error: 'bad_upstream_json', provider });
      return json(200, {
        provider,
        schema_id: 'miniapp_ai_material_analysis_v1',
        result: sanitizeResult(parsed, sourceType)
      });
    } catch (error) {
      if (provider === providerOrder[providerOrder.length - 1]) {
        return json(502, { error: 'upstream_failed', message: error.message });
      }
    }
  }

  return json(503, {
    error: 'not_configured',
    message: 'Configure DEEPSEEK_KEY / DEEPSEEK_API_KEY or QWEN_KEY / DASHSCOPE_API_KEY on the server.',
    fallback_required: true
  });
}
