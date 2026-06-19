export const config = { runtime: 'edge' };

import {
  clientRateKey,
  json,
  rateLimit,
  readJson,
  sessionSecret,
  verifySession
} from '../lib/mini-shared.js';

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
  'incentive_entitlement'
];

const BLOCKED_CLAIM_LABELS = {
  talent_label: 'no_fixed_trait_label',
  personality_label: 'no_fixed_trait_label',
  auto_grading: 'no_auto_grading_claim',
  ocr_claim: 'no_auto_ocr_claim',
  full_answer: 'no_full_answer',
  ranking: 'no_ranking_or_comparison',
  guaranteed_improvement: 'no_result_guarantee',
  diagnosis_label: 'no_fixed_diagnosis',
  incentive_entitlement: 'no_incentive_entitlement',
  '天赋标签': 'no_fixed_trait_label',
  '天赋定论': 'no_fixed_trait_label',
  '性格标签': 'no_fixed_trait_label',
  '自动批改': 'no_auto_grading_claim',
  'OCR': 'no_auto_ocr_claim',
  '完整答案': 'no_full_answer',
  '排名': 'no_ranking_or_comparison',
  '\u4fdd\u8bc1\u63d0\u5206': 'no_result_guarantee',
  '\u627f\u8bfa\u63d0\u5206': 'no_result_guarantee',
  '诊断标签': 'no_fixed_diagnosis',
  '\u5956\u52b1\u53d1\u653e': 'no_incentive_entitlement'
};

const BLOCKED_CLAIM_SAFE_TEXT = {
  no_fixed_trait_label: '仅作方法假设，不做固定标签',
  no_auto_grading_claim: '不承诺自动批改',
  no_auto_ocr_claim: '不承诺自动识别',
  no_full_answer: '不提供整题代写',
  no_ranking_or_comparison: '不做排名比较',
  no_result_guarantee: '不承诺结果变化',
  no_fixed_diagnosis: '不做固定诊断',
  no_incentive_entitlement: '\u4e0d\u91ca\u653e\u5b66\u4e60\u6fc0\u52b1\u6743\u76ca'
};

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
    practiceRecallRoute: '/pages/review/review?from=ai_material_analysis',
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

function normalizeBlockedClaim(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const key = BLOCKED_CLAIM_LABELS[raw] || BLOCKED_CLAIM_LABELS[raw.toLowerCase()];
  if (key) return key;
  if (/天赋|性格/.test(raw)) return 'no_fixed_trait_label';
  if (/自动批改/.test(raw)) return 'no_auto_grading_claim';
  if (/OCR|识别/.test(raw)) return 'no_auto_ocr_claim';
  if (/完整答案|直接答案|代写/.test(raw)) return 'no_full_answer';
  if (/排名|排行/.test(raw)) return 'no_ranking_or_comparison';
  if (/\u4fdd\u8bc1|\u627f\u8bfa|\u63d0\u5206|\u63d0\u5347/.test(raw)) return 'no_result_guarantee';
  if (/诊断|标签/.test(raw)) return 'no_fixed_diagnosis';
  if (/\u5956\u52b1|\u6743\u76ca/.test(raw)) return 'no_incentive_entitlement';
  return 'no_unsafe_claim';
}

function normalizeBlockedClaims(values) {
  return Array.from(new Set(safeList(values).map(normalizeBlockedClaim).filter(Boolean)));
}

function blockedClaimMessages(codes) {
  return normalizeBlockedClaims(codes).map((code) => BLOCKED_CLAIM_SAFE_TEXT[code] || '已移除不适合前端展示的表达');
}

function buildExecutionPath(raw, sourceType) {
  const path = raw.executionPath || raw.execution_path || {};
  const baseFrom = sourceType === 'talent_assessment' ? 'ai_material_method_validation' : 'ai_material_analysis';
  return {
    socraticRoute: safeText(path.socraticRoute || path.socratic_route, `/pages/tutor/tutor?from=${baseFrom}`),
    miniLessonRoute: safeText(path.miniLessonRoute || path.mini_lesson_route, '/pages/tutor/tutor?from=ai_material_analysis_mini_lesson'),
    practiceRecallRoute: safeText(path.practiceRecallRoute || path.practice_recall_route, '/pages/review/review?from=ai_material_analysis'),
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
  const blockedClaims = normalizeBlockedClaims(safeList(raw.blockedClaims).concat(safeList(raw.blocked_claims)).concat(blocked));
  const safeBlockedMessages = blockedClaimMessages(blockedClaims);
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
    risk_flags: normalizeBlockedClaims(safeList(raw.risk_flags).concat(blocked)),
    blocked_claims: blockedClaims,
    blocked_claim_messages: safeBlockedMessages,
    manual_confirmation_fields: Array.from(new Set(safeList(raw.manual_confirmation_fields).concat([
      'source_text_excerpt',
      'structured_evidence',
      'parent_confirmation'
    ]))),
    local_release_gate: sourceType === 'talent_assessment'
      ? 'talent_report_requires_real_wrong_question_and_day7_variant'
      : 'material_analysis_requires_structured_evidence_and_parent_confirmation',
    blockedClaims: blockedClaims,
    blockedClaimMessages: safeBlockedMessages
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
        'Every nextAction must route into the product execution path: Socratic tutor, mini lesson, practice recall only after evidence, and parent review.',
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
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:material-analysis'), 80);
  if (!limited.ok) {
    return json({ error: 'rate_limited', resetAt: limited.resetAt }, 429);
  }

  const env = typeof process !== 'undefined' && process.env ? process.env : {};
  const sessionHeader = req.headers.get('x-mini-session') || '';
  if (sessionHeader) {
    const session = await verifySession(sessionHeader, sessionSecret(env));
    if (!session.ok) return json({ error: 'invalid_session', mode: session.mode }, 401);
  }

  let body;
  try {
    body = await readJson(req, 32 * 1024);
  } catch (error) {
    return json({ error: error.message || 'bad_json' }, error.status || 400);
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
      if (!parsed) return json({ error: 'bad_upstream_json', provider }, 502);
      return json({
        provider,
        schema_id: 'miniapp_ai_material_analysis_v1',
        result: sanitizeResult(parsed, sourceType)
      }, 200);
    } catch (error) {
      if (provider === providerOrder[providerOrder.length - 1]) {
        return json({ error: 'upstream_failed', message: error.message }, 502);
      }
    }
  }

  return json({
    error: 'not_configured',
    message: 'Configure DEEPSEEK_KEY / DEEPSEEK_API_KEY or QWEN_KEY / DASHSCOPE_API_KEY on the server.',
    fallback_required: true
  }, 503);
}
