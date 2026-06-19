import { clean, clientRateKey, json, rateLimit, readJson, sessionSecret, verifySession } from '../mini-shared.js';
import { insertRows, nowIso, safeId, scrub, serviceContract } from '../mini-store.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:learning-report-recognize'), 80);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 32 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const text = clean(body.text || body.sourceText || body.recognizedText || '', 5000);
  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || '', sessionSecret(env));
  const jobId = safeId('recognize');
  const job = {
    job_id: jobId,
    session_id: clean(req.headers.get('x-mini-session') || '', 180) || null,
    user_id: session.ok ? clean(session.payload?.user_id || '', 100) || null : null,
    child_id: clean(body.child_id || body.student_id || session.payload?.child_id || '', 100) || null,
    status: text ? 'needs_parent_confirmation' : 'needs_manual_input',
    source: 'learning-report-recognize',
    input: scrub({ sourceType: body.sourceType || 'mixed', has_text: Boolean(text), material_id: body.material_id || '' }),
    result: scrub({ recognizedText: text, confidence: text ? 0.42 : 0.2 }),
    error_code: null,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  const stored = await insertRows('mini_report_jobs', job, 'return=representation');
  return json({
    ok: true,
    job_id: jobId,
    mode: text ? 'local_rules' : 'needs_manual_input',
    service_ready: false,
    persisted: Boolean(stored.ok),
    service_contract: {
      ...serviceContract('mini_report_jobs'),
      mode: 'local_rules_draft',
      persisted: Boolean(stored.ok),
      confirmation_required: true,
      evidence_required: ['recognized_text', 'parent_confirmation']
    },
    action_required: stored.ok ? 'ocr_provider_configuration' : 'recognition_storage_configuration',
    sourceType: clean(body.sourceType || 'mixed', 40),
    recognizedText: text,
    parsedScores: {},
    parsedRanks: {},
    assessmentSignals: {},
    confidence: text ? 0.42 : 0.2,
    requiresConfirmation: true,
    confirmPrompts: ['Confirm the subject, score, and current stuck point manually.'],
    missingFields: text ? ['confirmed_subject_or_score'] : ['recognized_text'],
    evidence: text ? ['User-provided text retained for manual confirmation.'] : [],
    updatedAt: new Date().toISOString(),
    persistence_warning: stored.ok ? '' : stored.error || ''
  });
}
