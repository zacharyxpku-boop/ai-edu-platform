#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'miniprogram', 'utils', 'import-intake.js');
const code = fs.readFileSync(file, 'utf8');
const sandbox = {
  module: { exports: {} },
  exports: {}
};
vm.runInNewContext(code, sandbox, { filename: file });
const intake = sandbox.module.exports;
const uploadPageCode = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.js'), 'utf8');
const uploadWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.wxml'), 'utf8');
assert(uploadPageCode.includes('Array.from(new Set(UPLOAD_DECISION_BLOCKED_FIELDS.concat('), 'upload report CTA unions fallback blocked fields instead of trusting sparse upstream lists');
assert(uploadPageCode.includes("'parent_phone'") && uploadPageCode.includes("'parent_wechat'") && uploadPageCode.includes("'child_name'") && uploadPageCode.includes("'contact_info'"), 'upload report/share release blocks raw child identity and parent contact fields');
let capturedUploadPage = null;
vm.runInNewContext(uploadPageCode, {
  module: { exports: {} },
  exports: {},
  console,
  Date,
  Page(definition) { capturedUploadPage = definition; },
  require(request) {
    if (request === '../../utils/import-intake') return intake;
    return {};
  }
}, { filename: path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.js') });
assert(uploadPageCode.includes('buildUploadEntryDeck'), 'upload page still builds the three-choice intake model in logic');
assert(uploadPageCode.includes('setUploadEntryMode'), 'upload page keeps learner mode switching logic for homework, stuck-point, and material inputs');
assert(uploadWxml.includes('upload-material-grid') && uploadWxml.includes('upload-material-card'), 'upload page now renders the three material entry cards in the compact visual shell');
assert(uploadWxml.includes('upload-dash-pipeline') && uploadWxml.includes('upload-subcheck'), 'upload page shows the current classify-to-report-to-tutor route without old deep controls');
assert(uploadWxml.includes('data-scene="upload"') && uploadWxml.includes('data-scene="parent"') && uploadWxml.includes('data-scene="today"'), 'upload page exposes stable scene jumps for upload, parent report, and tonight route');
assert(uploadPageCode.includes("['homework', 'stuck', 'material']"), 'upload entry modes are limited to the three intended choices');
assert(uploadPageCode.includes('patch.showMaterialPanel = true'), 'material entry opens the material panel in logic instead of hiding the next step');
assert(uploadPageCode.includes('decisionSource') && uploadPageCode.includes('sourceSchemaId') && uploadPageCode.includes('portraitConfidenceWeight'), 'upload page carries structured decision source into learning report state');
assert(uploadPageCode.includes('buildUploadIntakePacket(text, this.data.imagePaths, this.data.materialType)'), 'upload report save reuses the intake packet instead of flattening sources');
assert(uploadPageCode.includes('buildDecisionSource(uploadIntakePacket, text') && uploadPageCode.includes('lastDecisionSource'), 'upload submit and material import share one decision-source contract');
assert(uploadPageCode.includes('buildStructuredEvidenceCapture') && uploadPageCode.includes('structuredEvidenceCapture') && uploadPageCode.includes('onStructuredEvidenceInput'), 'upload page keeps structured evidence capture logic for report thickening');
assert(uploadPageCode.includes("!['talent_assessment', 'score_sheet'].includes(decisionSource.sourceSchemaId)") && uploadPageCode.includes('methodCandidateOnly'), 'talent assessment and score sheets enter reports instead of direct review cards');
assert(uploadPageCode.includes('buildReportCta') && uploadPageCode.includes('viewLatestReport'), 'upload save keeps report CTA logic after material intake');
assert(uploadPageCode.includes('buildTonightTaskCard') && uploadPageCode.includes('tonightTaskCard'), 'upload report CTA builds a compact tonight task card in logic');
assert(uploadPageCode.includes('runReportGameAction'), 'upload keeps a direct light-practice follow-through in logic');
assert(uploadPageCode.includes('aiLocalBoundary') && uploadPageCode.includes('source_type_classification') && uploadPageCode.includes('aiMustNotOwn'), 'upload report CTA carries the AI/local ownership boundary');
assert(uploadPageCode.includes('talent_assessment_requires_real_wrong_question_before_practice'), 'talent assessment CTA forces real wrong-question validation before practice');
assert(!uploadWxml.includes('safeRelayPayload.returnRoute'), 'upload compact UI does not expose raw return routes');
assert(uploadPageCode.includes('material_${this.data.materialType}:${decisionSource.sourceSchemaId}') && uploadPageCode.includes('requiredNextEvidence: decisionSource.requiredNextEvidence'), 'material import preserves source schema and next-evidence gates in the review deck source');
assert(uploadPageCode.includes('miniLessonSourceEvidence') && uploadPageCode.includes('structuredEvidenceSignals') && uploadPageCode.includes('sourceTextForMiniLesson'), 'upload report CTA passes real material evidence into the mini-lesson topic-card selector');
assert(uploadPageCode.includes('inferUploadSubjectTask') && uploadPageCode.includes('UPLOAD_SUBJECT_TASK_PATTERNS'), 'upload infers subject/task type from structured material evidence instead of degrading school material to general');
assert(uploadPageCode.includes('structuredEvidenceSignals.taskType || decisionSource.taskType') && uploadPageCode.includes('subjectKey: structuredEvidenceSignals.subjectKey'), 'upload threads subjectKey/taskType into report, mini-lesson, and review import metadata');
assert.strictEqual((uploadPageCode.match(/^  buildStructuredEvidenceSignals\(/gm) || []).length, 1, 'upload page has one active structured evidence signal builder');
assert.strictEqual((uploadPageCode.match(/^  buildStructuredEvidenceCapture\(/gm) || []).length, 1, 'upload page has one active structured evidence capture builder');
assert(uploadPageCode.includes('topicCardId') && uploadPageCode.includes('activeRecallLadderCount'), 'upload report handoff preserves mini-lesson topic card and active recall ladder evidence');
assert(uploadPageCode.includes('uploadedMaterialDecisionDossier') && uploadPageCode.includes('cta.uploadedMaterialDecisionDossier'), 'upload persists the material decision dossier back into report state');
assert(uploadPageCode.includes('buildMaterialTypeGuide') && uploadPageCode.includes('examplePlaceholder'), 'upload material guide keeps source-specific examples in logic');
assert(code.includes("'parent_private_priority_only'") && uploadPageCode.includes('methodCandidateOnly'), 'upload material guidance preserves method-candidate and private-score handling');
assert(uploadPageCode.includes('previewWrongQuestionsToReview'), 'upload can preview wrong-question import without writing review assets');
const afterPriorityStart = uploadPageCode.indexOf('afterPrioritySaved(text, state, plan, mode)');
const afterPriorityEnd = uploadPageCode.indexOf('\n  async ', afterPriorityStart);
const afterPrioritySavedBlock = uploadPageCode.slice(afterPriorityStart, afterPriorityEnd > afterPriorityStart ? afterPriorityEnd : undefined);
assert(afterPrioritySavedBlock.indexOf('previewWrongQuestionsToReview(text)') >= 0, 'upload report path starts with wrong-question preview');
assert(afterPrioritySavedBlock.indexOf('requiresStructuredEvidenceGate') < afterPrioritySavedBlock.indexOf('importWrongQuestionsToReview(text, state, plan)'), 'upload writes wrong-question review cards only after structured evidence gate passes');
assert(afterPrioritySavedBlock.indexOf('requiresStructuredEvidenceGate') < afterPrioritySavedBlock.indexOf('saveFocusFromUploadText(text, state, plan)'), 'upload writes today-focus evidence only after structured evidence gate passes');
const homework = intake.classifyImportInput('把一根长1.2米的圆柱形钢材截成3段，表面积增加了6.28平方分米。这根钢材原来的体积是多少？');
assert.strictEqual(homework.kind, 'homework_question', 'pasted question routes to homework tutoring');
assert.strictEqual(homework.route, 'tutor', 'pasted question opens tutor');
assert.strictEqual(homework.shouldCreateFocus, false, 'pasted question does not create a stuck focus by itself');
assert.ok(!/答案|秒解|拍照出答案/.test(homework.feedback), 'pasted question feedback does not promise answers');

const stuck = intake.classifyImportInput('我不会列式');
assert.strictEqual(stuck.kind, 'stuck_point', 'stuck wording is classified as stuck point');
assert.strictEqual(stuck.route, 'today_focus', 'stuck wording writes todayFocus');
assert.strictEqual(stuck.shouldCreateFocus, true, 'stuck wording creates todayFocus');

const review = intake.classifyImportInput('我想复习这个');
assert.strictEqual(review.kind, 'review_request', 'review wording is classified as review request');
assert.strictEqual(review.route, 'review', 'review wording routes to review/knowledge playground');
assert.strictEqual(review.shouldCreateFocus, false, 'review wording does not replace active focus');

const photoOnly = intake.buildUploadIntakePacket('', ['tmp/a.jpg'], 'wrong_question_photo');
assert.strictEqual(photoOnly.kind, 'photo_evidence_needs_text', 'photo-only upload stays local until the learner adds a stuck point');
assert.strictEqual(photoOnly.imageCount, 1, 'photo packet counts local images');
assert(photoOnly.feedback.includes('照片') && photoOnly.feedback.includes('错因'), 'photo packet asks for wrong-cause text instead of pretending OCR');
assert(photoOnly.blockedFields.includes('photo_ocr_claim') && photoOnly.blockedFields.includes('original_answer'), 'photo packet blocks fake OCR and answer fields');
['talent_label', 'personality_label', 'private_comment', 'original_question', 'full_dialogue'].forEach((field) => {
  assert(photoOnly.blockedFields.includes(field), `photo packet blocks ${field}`);
});
assert(Array.isArray(photoOnly.nextActionQueue) && photoOnly.nextActionQueue.length >= 5, 'photo packet exposes a next-action queue');
assert(photoOnly.nextActionQueue.find((item) => item.id === 'complete_stuck_point' && item.status === 'required'), 'photo packet requires the learner to add a stuck point before release');
assert(photoOnly.nextActionQueue.find((item) => item.id === 'socratic_first_step' && item.status === 'locked'), 'photo-only packet locks Socratic tutoring until text evidence exists');

const linkOnly = intake.buildUploadIntakePacket('https://example.com/math', [], 'web_article');
assert.strictEqual(linkOnly.hasOnlyLink, true, 'link-only packet is recognized');
assert.notStrictEqual(linkOnly.kind, 'first_thought', 'link-only packet is not treated as a first thought');
assert.strictEqual(linkOnly.kind, 'link_excerpt_needs_text', 'link-only packet requires a pasted excerpt or stuck point');
assert.strictEqual(linkOnly.nextRoute, '/pages/upload/upload', 'link-only packet stays on upload instead of entering tutor');
assert(linkOnly.blockedFields.includes('auto_link_crawl'), 'link-only packet blocks automatic link crawling');
assert(linkOnly.reviewSeed.boundary.includes('不抓链接'), 'link-only packet states crawl boundary');
assert(linkOnly.nextActionQueue.every((item) => item.owner !== 'ai_only'), 'link-only packet never lets AI own release-critical actions');
assert(linkOnly.nextActionQueue.find((item) => item.id === 'socratic_first_step' && item.status === 'locked'), 'link-only packet locks Socratic tutoring until excerpt text exists');

const wrongTextPacket = intake.buildUploadIntakePacket('错题订正：应用题卡在等量关系，想要举一反三。', ['tmp/wrong.jpg'], 'wrong_question_photo');
assert(wrongTextPacket.hasText, 'wrong-question packet carries text evidence');
assert(wrongTextPacket.imageCount === 1, 'wrong-question packet can attach local photo evidence');
assert(wrongTextPacket.nextRoute.includes('/pages/review/review') || wrongTextPacket.nextRoute.includes('/pages/tutor/tutor'), 'wrong-question packet routes into the learning loop');
assert(wrongTextPacket.reportSeed && wrongTextPacket.reviewSeed, 'wrong-question packet seeds both report and review');
assert(wrongTextPacket.aiBoundary.includes('AI') && wrongTextPacket.aiBoundary.includes('本地规则'), 'packet separates AI wording from local routing rules');
assert(wrongTextPacket.nextActionQueue.some((item) => item.id === 'review_card_seed' && item.route === '/pages/review/review'), 'wrong-question packet exposes a review-card action');
assert(wrongTextPacket.nextActionQueue.some((item) => item.id === 'first_step_challenge' && item.releaseGate.includes('不带原题')), 'wrong-question packet exposes a privacy-safe first-step challenge');
assert.strictEqual(wrongTextPacket.intakeSourceSchema.id, 'wrong_question_paper', 'wrong-question packet maps to wrong-question intake schema');
assert.strictEqual(JSON.stringify(wrongTextPacket.requiredTextFields), JSON.stringify(['question_type', 'child_original_thought', 'stuck_first_step', 'wrong_cause_guess']), 'wrong-question packet asks for structured capture fields before stronger report release');
assert(wrongTextPacket.structuredCapturePrompts.length >= 4 && wrongTextPacket.reportSeed.structuredCapturePrompts.length >= 4, 'structured capture prompts flow into the report seed');
assert(wrongTextPacket.photoEvidencePolicy && wrongTextPacket.photoEvidencePolicy.ocrClaim === false && wrongTextPacket.photoEvidencePolicy.blockedUse.includes('auto_answer'), 'photo evidence stays local/manual and blocks fake OCR-answer claims');
assert(wrongTextPacket.reportSeed.evidenceGap.includes('孩子原想法'), 'wrong-question report seed names the missing child thinking evidence');
assert(wrongTextPacket.intakeSourceSchema.aiBlocked.includes('完整答案'), 'wrong-question schema blocks full-answer AI use');

const ocrBaitPacket = intake.buildUploadIntakePacket('请 OCR 识别这张错题照片并自动批改，直接给整卷答案。', ['tmp/ocr-bait.jpg'], 'wrong_question_photo');
assert(ocrBaitPacket.photoEvidencePolicy && ocrBaitPacket.photoEvidencePolicy.ocrClaim === false, 'OCR-bait photo still does not claim OCR');
assert(ocrBaitPacket.aiReportDraftAdapter.aiMustNotOwn.includes('ocr_claim'), 'AI report draft cannot own OCR claims');
assert(ocrBaitPacket.aiReportDraftAdapter.aiMustNotOwn.includes('auto_grading'), 'AI report draft cannot own auto grading');
assert(ocrBaitPacket.blockedFields.includes('photo_ocr_claim') && ocrBaitPacket.blockedFields.includes('full_solution'), 'OCR-bait packet blocks fake OCR and full-solution fields');

const talentPacket = intake.buildUploadIntakePacket('天赋测评摘要：孩子偏视觉型，听讲容易走神，动笔拆步骤会更稳定。', [], 'talent_assessment');
assert.strictEqual(talentPacket.intakeSourceSchema.id, 'talent_assessment', 'talent assessment packet maps to talent schema');
assert(talentPacket.reportSeed.reportUse.includes('候选'), 'talent assessment is only a learning-method candidate');
assert.strictEqual(talentPacket.reportSeed.releaseScope, 'method_candidate_only', 'talent assessment only releases method candidate');
assert.strictEqual(talentPacket.reportSeed.portraitConfidenceWeight, 0, 'talent assessment does not raise portrait confidence');
assert.strictEqual(talentPacket.reportSeed.scoreRankingPolicy, 'degrade_to_unreleased_reference', 'talent assessment score/rank is downgraded before report release');
assert.strictEqual(JSON.stringify(talentPacket.requiredTextFields), JSON.stringify(['preference_candidate', 'method_hypothesis', 'cross_check_gate', 'review_window']), 'talent assessment asks for method-hypothesis evidence, not wrong-question fields');
assert(talentPacket.structuredCapturePrompts.every((item) => talentPacket.requiredTextFields.includes(item.id)), 'talent structured prompts follow the talent schema local fields');
assert.strictEqual(talentPacket.methodValidationChallengeChain.id, 'method_validation_challenge_chain', 'talent assessment creates a method validation challenge chain');
assert.strictEqual(talentPacket.methodValidationChallengeChain.sourceSchemaId, 'talent_assessment', 'talent challenge chain keeps source schema');
assert.strictEqual(talentPacket.methodValidationChallengeChain.stages.length, 3, 'talent method validation requires real task, revisit, and day-7 variant');
assert(talentPacket.methodValidationChallengeChain.aiMustNotOwn.includes('talent_label'), 'talent method validation blocks AI talent labeling');
assert(talentPacket.reportSeed.methodValidationChallengeChain.reportCopy.includes('天赋是什么'), 'talent report copy avoids deterministic talent claims');
assert(talentPacket.intakeSourceSchema.evidenceGap.includes('第 7 天小变式'), 'talent assessment requires day-7 evidence before stronger claims');
assert(talentPacket.intakeSourceSchema.aiBlocked.includes('天赋定性'), 'talent assessment blocks AI talent determination');
['talent_label', 'personality_label', 'private_comment', 'original_question', 'full_dialogue'].forEach((field) => {
  assert(talentPacket.blockedFields.includes(field), `talent packet blocks ${field}`);
});

const schoolPacket = intake.buildUploadIntakePacket('老师反馈：课堂能听懂，作业应用题列式慢，建议家长先看孩子是否能复述题意。', [], 'school_material');
assert.strictEqual(schoolPacket.intakeSourceSchema.id, 'school_material', 'school material packet maps to school schema');
assert(schoolPacket.reportSeed.reportUse.includes('家校摘要'), 'school material can produce home-school digest');
assert(schoolPacket.intakeSourceSchema.aiBlocked.includes('替老师判断'), 'school material blocks AI teacher replacement');
assert(capturedUploadPage && typeof capturedUploadPage.buildStructuredEvidenceSignals === 'function', 'upload page exposes structured evidence signal builder for behavior checks');
const schoolSignals = capturedUploadPage.buildStructuredEvidenceSignals(schoolPacket, '老师反馈：数学应用题列式慢，能复述题意，但第一步不知道先找关系。', {});
assert(schoolSignals.subjectKey && schoolSignals.subjectLabel && schoolSignals.taskType, 'school feedback preserves subject/task inference into report sources');
const incompleteSchoolCapture = capturedUploadPage.buildStructuredEvidenceCapture(schoolPacket, '老师反馈：数学应用题列式慢。', {
  teacher_observation: '课堂能听懂',
  classroom_signal: '应用题列式慢',
  home_school_question: '先问能否复述题意'
});
assert.strictEqual(incompleteSchoolCapture.ready, false, 'school material missing safe_handoff does not pass structured gate');
assert(incompleteSchoolCapture.missing.length >= 1, 'school material names missing structured evidence');

const scorePacket = intake.buildUploadIntakePacket('score sheet: math 82, word problems lost 10 points; English reading is slow.', [], 'score_sheet');
assert.strictEqual(scorePacket.intakeSourceSchema.id, 'score_sheet', 'score sheet packet maps to score schema');
assert.strictEqual(scorePacket.reportSeed.releaseScope, 'parent_private_priority_only', 'score sheet releases only private parent priority');
assert.strictEqual(scorePacket.reportSeed.scoreRankingPolicy, 'private_parent_priority_only_no_share_no_reward', 'score sheet blocks score use in sharing and rewards');
assert.strictEqual(JSON.stringify(scorePacket.requiredTextFields), JSON.stringify(['score_subjects', 'weak_subject_candidate', 'wrong_question_anchor', 'parent_private_confirm']), 'score sheet asks for score fields, weak candidate, wrong-question anchor, and parent confirmation');
assert(scorePacket.personalizedUploadSolutionRunway.externalKeyUse.notAllowedFor.includes('ranking_or_score_claim'), 'external AI cannot own score or ranking claims');

const parentPacket = intake.buildUploadIntakePacket('家长观察：晚上作业拖拉，遇到数学应用题情绪急，能说题意但不愿意写第一步。', [], 'parent_report');
assert.strictEqual(parentPacket.intakeSourceSchema.id, 'parent_report', 'parent observation packet maps to parent report schema');
assert(parentPacket.reportSeed.reportUse.includes('家庭决策书'), 'parent report can produce a family decision memo');
assert(parentPacket.intakeSourceSchema.aiBlocked.includes('孩子能力定性'), 'parent report blocks capability labeling');
assert(talentPacket.aiReportDraftAdapter && talentPacket.aiReportDraftAdapter.id === 'ai_report_draft_adapter', 'talent packet carries an AI report draft adapter');
assert.strictEqual(talentPacket.aiReportDraftAdapter.status, 'method_candidate_only', 'AI report draft keeps talent material as method candidate only');
assert(talentPacket.aiReportDraftAdapter.localCodeOwns.includes('release_gate') && talentPacket.aiReportDraftAdapter.localCodeOwns.includes('day7_evidence_gate'), 'local code owns report release and day-7 evidence gates');
assert(talentPacket.aiReportDraftAdapter.aiMustNotOwn.includes('talent_label') && talentPacket.aiReportDraftAdapter.aiMustNotOwn.includes('reward_release'), 'AI draft adapter blocks talent labels and reward release');
assert(talentPacket.aiReportDraftAdapter.draftSeed.miniLessonCandidate && talentPacket.aiReportDraftAdapter.draftSeed.socraticQuestions.length === 3, 'AI draft adapter only seeds summary, questions, action, and mini-lesson candidate');
assert(talentPacket.personalizedUploadSolutionRunway && talentPacket.personalizedUploadSolutionRunway.id === 'personalized_upload_solution_runway', 'talent packet carries a personalized upload solution runway');
assert.strictEqual(talentPacket.personalizedUploadSolutionRunway.recommendedMode.id, 'socratic_validation_first', 'talent assessment starts with Socratic method validation');
assert.strictEqual(talentPacket.personalizedUploadSolutionRunway.closedLoop.length, 5, 'upload solution runway closes intake, first step, repair/lesson, game return, and parent report');
assert(talentPacket.personalizedUploadSolutionRunway.externalKeyUse.usefulFor.includes('material_summary_candidate'), 'external key is useful for summary and wording');
assert(talentPacket.personalizedUploadSolutionRunway.externalKeyUse.mustBeGuardedByLocalCode.includes('evidence_release'), 'local code guards evidence release');
assert(talentPacket.personalizedUploadSolutionRunway.externalKeyUse.notAllowedFor.includes('talent_label'), 'external key cannot own talent labels');
assert(talentPacket.personalizedUploadSolutionRunway.releaseGates.includes('day7_variant_before_method_claim'), 'method claims require day-7 evidence');
assert(talentPacket.personalizedUploadSolutionRunway.blockedFields.includes('full_solution') && talentPacket.personalizedUploadSolutionRunway.blockedFields.includes('ranking'), 'solution runway blocks full solutions and ranking fields');
assert(talentPacket.realAiMaterialAnalysisContract && talentPacket.realAiMaterialAnalysisContract.id === 'real_ai_material_analysis_contract', 'talent packet carries a real AI material-analysis contract');
assert.strictEqual(talentPacket.realAiMaterialAnalysisContract.endpointPath, '/api/miniapp-material-analysis', 'AI material-analysis contract points to the server-side endpoint');
assert.strictEqual(talentPacket.realAiMaterialAnalysisContract.request.transport, 'server_env_key_only', 'AI material-analysis contract requires server env keys, not client keys');
assert.strictEqual(talentPacket.realAiMaterialAnalysisContract.request.providerPolicy.clientMaySendKey, false, 'miniapp client must not send provider keys');
assert(talentPacket.realAiMaterialAnalysisContract.releaseGates.includes('blocked_claim_sanitized') && talentPacket.realAiMaterialAnalysisContract.releaseGates.includes('parent_manual_confirmation'), 'AI material-analysis contract requires sanitizer and parent confirmation gates');
assert(talentPacket.realAiMaterialAnalysisContract.sanitizerPolicy.talentDegradeRule.includes('hypotheses'), 'AI material-analysis contract degrades talent reports to method hypotheses');
const unsafeAiResult = intake.sanitizeAiMaterialAnalysisResult({
  source_type: 'talent_assessment',
  learning_method_candidates: ['visual learner label', 'first-step blackboard'],
  socratic_next_questions: ['What is the first step?', 'The complete answer is 42'],
  family_solution_book: { onePageDiagnosis: 'OCR says the child talent label is fixed' },
  ranking: 'top 10%',
  blocked_claims: ['ocr_claim']
}, { sourceSchemaId: 'talent_assessment' });
assert.strictEqual(unsafeAiResult.status, 'sanitized_requires_manual_confirmation', 'unsafe AI result is sanitized before report release');
assert(unsafeAiResult.blockedClaims.includes('ranking') && unsafeAiResult.blockedClaims.includes('ocr_claim'), 'sanitizer detects ranking and OCR claims');
assert(unsafeAiResult.localReleaseGate.includes('talent_report_ai_draft_requires_real_wrong_question'), 'talent AI result still requires real wrong-question validation');
assert(unsafeAiResult.aiLocalBoundary.localCodeOwns.includes('release_gate') && unsafeAiResult.aiLocalBoundary.aiMustNotOwn.includes('reward_release'), 'sanitized AI result preserves local release ownership');
assert(unsafeAiResult.subject && unsafeAiResult.wrongCause && unsafeAiResult.firstStep && unsafeAiResult.learningPreference, 'sanitized AI result always exposes normalized solution fields');
assert(unsafeAiResult.evidenceConfidence && unsafeAiResult.evidenceConfidence.level === 'low', 'sanitized AI result degrades weak evidence to low confidence');
assert(unsafeAiResult.nextAction && unsafeAiResult.nextAction.route.includes('/pages/tutor/tutor'), 'sanitized AI result always routes to a guarded next action');
assert(unsafeAiResult.executionPath.socraticRoute.includes('/pages/tutor/tutor') && unsafeAiResult.executionPath.gameRecallRoute.includes('/pages/arcade/arcade'), 'sanitized AI result carries product execution routes');
const fallbackAnalysis = intake.buildAiMaterialAnalysisFallback(talentPacket, { firstStep: '先复述题意' }, 'service_not_configured');
assert(fallbackAnalysis.riskFlags.includes('service_not_configured'), 'AI analysis fallback records service-not-configured risk');
assert(fallbackAnalysis.manualConfirmationFields.includes('parent_confirmation'), 'AI analysis fallback requires manual parent confirmation');
assert(fallbackAnalysis.nextAction.route.includes('/pages/tutor/tutor') && fallbackAnalysis.firstStep, 'AI analysis fallback still produces a usable guarded next action');
assert(fallbackAnalysis.evidenceConfidence.requiredNextEvidence.includes('structured_evidence'), 'AI analysis fallback names the missing evidence required before release');
assert(fallbackAnalysis.analysisQuality && fallbackAnalysis.analysisQuality.status === 'fallback_or_manual_confirm', 'AI analysis fallback carries a quality gate before release');
assert(fallbackAnalysis.analysisQuality.missingEvidence.includes('stronger_evidence'), 'AI analysis quality gate names missing stronger evidence');
assert(Array.isArray(intake.INTAKE_SOURCE_SCHEMAS) && intake.INTAKE_SOURCE_SCHEMAS.length === 5, 'five explicit intake schemas are exported');
const incompleteTalentCapture = capturedUploadPage.buildStructuredEvidenceCapture(talentPacket, '测评摘要：孩子偏听觉型，复述后更稳定。', {
  preference_candidate: '听觉型/复述有效',
  method_hypothesis: '先复述题意再动笔',
  review_window: '明天用一题错题回访'
});
assert.strictEqual(incompleteTalentCapture.ready, false, 'talent assessment missing cross_check_gate does not pass structured gate');
const genericTalentCapture = capturedUploadPage.buildStructuredEvidenceCapture(talentPacket, '测评摘要：孩子偏听觉型，复述后更稳定。', {
  preference_candidate: '听觉型复述有效',
  method_hypothesis: '需要观察',
  cross_check_gate: '看情况',
  review_window: '明天再说'
});
assert.strictEqual(genericTalentCapture.ready, false, 'generic talent capture does not pass structured evidence gate');
assert(genericTalentCapture.fields.some((field) => field.qualityIssue === 'need_specific_real_task_evidence'), 'generic talent capture names quality issue');

[
  {
    text: '公众号摘录：二次函数的顶点式可以看作从一般式配方得到，先找对称轴，再看开口方向和顶点坐标。',
    inputType: 'wechat_article'
  },
  {
    text: 'https://example.com/math 这篇网页讲一元一次方程移项时要变号，核心例子是 3x+5=20，先把常数项移到右边。',
    inputType: 'web_article'
  },
  {
    text: 'PDF 摘录：牛顿第一定律说明物体在不受外力或合外力为零时，会保持静止或匀速直线运动状态。',
    inputType: 'pdf_excerpt'
  }
].forEach((sample) => {
  const material = intake.classifyImportInput(sample.text);
  assert.strictEqual(material.kind, 'material_source', `${sample.inputType} routes as material source`);
  assert.strictEqual(material.route, 'review', `${sample.inputType} routes to review, not direct tutor answer`);
  assert.strictEqual(material.inputType, sample.inputType, `${sample.inputType} keeps source type`);
  assert.strictEqual(material.shouldCreateFocus, false, `${sample.inputType} does not create today focus`);
  assert.ok(material.sourceMeta && material.sourceMeta.type === sample.inputType, `${sample.inputType} exposes source metadata`);
  assert.ok(!/秒解|拍照|自动解析|给出答案|生成答案/.test(material.feedback), `${sample.inputType} feedback avoids fake capability`);
  assert.ok(/只处理你粘贴的摘录|不自动抓取链接|不解析文件/.test(material.feedback), `${sample.inputType} states import boundary`);
  const packet = intake.buildUploadIntakePacket(sample.text, [], sample.inputType);
  assert.strictEqual(packet.kind, 'material_source', `${sample.inputType} packet keeps material source kind`);
  assert.strictEqual(packet.nextRoute, '/pages/review/review', `${sample.inputType} packet routes to review`);
  assert(packet.reviewSeed.shouldImport, `${sample.inputType} packet can seed review import`);
  assert(packet.reportSeed.confidence > 0.5, `${sample.inputType} packet can seed report evidence`);
  assert(packet.nextActionQueue.some((item) => item.id === 'socratic_first_step' && item.owner === 'ai_with_local_guardrail'), `${sample.inputType} keeps Socratic AI behind local guardrails`);
  assert(packet.nextActionQueue.some((item) => item.id === 'parent_report_seed' && item.owner === 'local_rule'), `${sample.inputType} writes parent report through local rules`);
});

['我读不懂题', '我不会列式', '我想复习这个', '我想做同类题'].forEach((label) => {
  assert(intake.IMPORT_CHIPS.some((chip) => chip.label === label), `import MVP chip exists: ${label}`);
});

assert(uploadPageCode.includes('openMaterialReportPanel') && uploadWxml.includes('upload-material-grid'), 'upload page promotes parent material report intake through the compact first-screen material grid');
assert(uploadWxml.includes('学习偏好/测评资料') && uploadWxml.includes('成绩单/周测') && uploadWxml.includes('错题试卷'), 'upload first-screen report entry exposes talent, score, and wrong-question lanes without old controls');
assert(uploadPageCode.includes('chooseMaterialFile') && uploadPageCode.includes('wx.chooseMessageFile'), 'upload supports selecting PDF/report files as local evidence before text extraction');
assert(uploadPageCode.includes('buildGuardedAiReportDraft') && uploadPageCode.includes('guardedAiReportDraft'), 'upload page builds a guarded AI report draft before saving report state');
assert(uploadPageCode.includes('requestAiMaterialAnalysis') && uploadPageCode.includes('api.analyzeMiniappMaterial') && uploadPageCode.includes('sanitizeAiMaterialAnalysisResult'), 'upload page calls server AI analysis and sanitizes/falls back locally');
assert(uploadPageCode.includes('requiresStructuredEvidenceGate') && uploadPageCode.includes('已分类，报告待补证据'), 'upload page blocks report handoff until structured evidence is ready');
assert(uploadPageCode.includes('structuredEvidenceCapture.ready') && uploadPageCode.includes('structuredEvidenceCapture.values'), 'upload page threads structured evidence into report generation');
assert(uploadWxml.includes('不公开分享') && uploadWxml.includes('先分类再分析'), 'upload report CTA shows the local evidence boundary to parents through compact copy');
assert(uploadWxml.includes('家长报告') && uploadWxml.includes('证据与方法匹配'), 'upload report entry routes AI/local analysis into the parent report jump instead of old inline controls');

let runtimeUploadPage = null;
vm.runInNewContext(uploadPageCode, {
  module: { exports: {} },
  exports: {},
  console,
  Date,
  Page(definition) { runtimeUploadPage = definition; },
  require(request) {
    if (request === '../../utils/import-intake') return intake;
    if (request === '../../utils/openmaic-inspired-plan') {
      return {
        buildOpenMaicInspiredTaskPlan() {
          return {
            miniLesson: { topicCard: { id: 'runtime_topic', localGate: 'child_can_say_first_step' } }
          };
        },
        buildOpenMaicInspiredDecisionBridge() {
          return {
            shareRelayPayload: { blockedFields: ['original_question'] },
            gameReturnEvidence: { activeRecallRevisitLadder: ['day1', 'day2'] }
          };
        },
        evaluateOpenMaicInspiredTaskPlan() {
          return { ok: true, riskCount: 0 };
        }
      };
    }
    if (request === '../../utils/learning-service-pathway') {
      return {
        buildLearningServicePathway(input = {}) {
          const signals = input.structuredEvidenceSignals || {};
          const hasGameEvidence = !!(signals.firstStep || signals.stuckFirstStep || signals.wrongCause || signals.wrongCauseGuess || input.cardId || Number(input.importedCards || 0) > 0);
          return {
            id: 'runtime_service_pathway',
            status: 'ready',
            nextRoute: '/pages/tutor/tutor?from=test',
            modeRecommendations: hasGameEvidence ? [{ id: 'game_recall' }] : [],
            safetyBoundary: { releaseGate: 'parent_confirmation', blocked: ['full_answer'] },
            validationPlan: ['first_step', 'next_day_revisit'],
            partnerHandoffPolicy: { status: 'safe_summary_only' }
          };
        }
      };
    }
    if (request === '../../utils/partner-delivery-workbench') {
      return {
        buildPartnerDeliveryWorkbench() {
          return { id: 'runtime_partner_workbench', status: 'ready' };
        }
      };
    }
    return {};
  }
}, { filename: path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.js') });
const runtimeCta = runtimeUploadPage.buildReportCta({
  sourceSchemaId: 'school_material',
  sourceSchemaLabel: '学校反馈',
  subjectLabel: '数学',
  taskType: 'math_word_problem',
  blockedFields: ['score']
}, {
  parsedScores: {
    '数学': { subject: '数学', score: 98, confidence: 0.9 }
  },
  reportDraft: {
    id: 'report_runtime_1',
    parsedScores: {
      '数学': { subject: '数学', score: 98, confidence: 0.9 }
    },
    behaviorSignals: { firstStep: '先复述题意', wrongCause: '等量关系不清' }
  }
}, {
  sourceText: '老师反馈：应用题列式慢，先复述题意再找等量关系。',
  structuredEvidenceSignals: {
    subjectLabel: '数学',
    taskType: 'math_word_problem',
    firstStep: '先复述题意',
    wrongCause: '等量关系不清'
  }
});
assert(runtimeCta.aiMaterialAnalysisContract, 'runtime report CTA builds the AI material-analysis contract without a temporal-dead-zone crash');
assert(runtimeCta.aiMaterialAnalysisContract.request.payload.confirmed_scores, 'runtime report CTA threads confirmed score references into AI analysis contract');
assert.strictEqual(runtimeCta.aiMaterialAnalysisContract.request.payload.subject, '数学', 'runtime report CTA threads subject into the AI analysis contract');
assert(runtimeCta.aiMaterialSolutionView && runtimeCta.aiMaterialSolutionView.id === 'upload_ai_material_solution_view', 'runtime report CTA renders a readable AI material solution view');
assert(runtimeCta.aiMaterialSolutionView.firstStepLine && runtimeCta.aiMaterialSolutionView.nextActionRoute.includes('/pages/tutor/tutor'), 'AI material solution view exposes first step and guarded tutor route');
assert(runtimeCta.aiMaterialSolutionView.qualityLine.includes('quality gate'), 'AI material solution view exposes analysis quality gate');
assert(runtimeCta.aiMaterialSolutionView.scoreLine.includes('confirmed subjects') && runtimeCta.aiMaterialSolutionView.scoreUseLine.includes('not to promise score improvement'), 'AI material solution view explains confirmed score use without score-improvement promises');
assert(runtimeCta.aiMaterialSolutionView.coverageLine.includes('coverage') && runtimeCta.aiMaterialSolutionView.coverageFallbackLine.includes('Socratic'), 'AI material solution view exposes content coverage and fallback evidence');
assert(runtimeCta.aiMaterialSolutionView.routes.some((item) => item.id === 'game_recall' && item.route.includes('/pages/arcade/arcade')), 'AI material solution view carries game recall route behind evidence gates');
assert(runtimeCta.scoreSignalView && runtimeCta.contentCoverageReceipt, 'runtime report CTA carries score and content coverage receipts');
assert(runtimeCta.dailyExecutionSeed && runtimeCta.dailyExecutionSeed.reviewRoute.includes('/pages/review/review'), 'runtime report CTA creates a daily execution seed after uploaded-material analysis');
assert(runtimeCta.dailyExecutionSeed.gameLine.includes('主动回忆') && runtimeCta.dailyExecutionSeed.releaseLine.includes('明天回访'), 'daily execution seed turns uploaded material into active recall and next-day revisit');
assert(runtimeCta.dailyExecutionSeed.syncPayload && runtimeCta.dailyExecutionSeed.syncPayload.evidence_required.includes('wrong_cause_named'), 'daily execution seed has a sync-safe evidence contract');
assert(runtimeCta.partnerDeliveryWorkbench && runtimeCta.partnerDeliveryWorkbench.id === 'runtime_partner_workbench', 'runtime report CTA still builds partner delivery workbench');
assert(runtimeCta.tonightTaskCard && runtimeCta.tonightTaskCard.firstStep, 'runtime report CTA still builds tonight task card');
assert(runtimeCta.gameRoute && runtimeCta.tonightTaskCard.gameRoute, 'runtime report CTA opens game only when first-step and wrong-cause evidence exist');
assert(runtimeCta.blockedFields.includes('parent_phone') && runtimeCta.blockedFields.includes('parent_wechat'), 'runtime report CTA blocks parent contact fields from report/share handoff');
assert(runtimeCta.safeRelayPayload.blockedFields.includes('child_name') && runtimeCta.safeRelayPayload.blockedFields.includes('contact_info'), 'runtime safe relay payload blocks raw child identity and contact info');

const photoOnlyRuntimeCta = runtimeUploadPage.buildReportCta({
  sourceSchemaId: 'wrong_question_photo',
  sourceSchemaLabel: '错题照片',
  subjectLabel: '数学',
  taskType: 'math_word_problem'
}, {
  reportDraft: {
    id: 'report_runtime_photo_only',
    behaviorSignals: {}
  }
}, {
  sourceText: '家长上传了一张错题照片，但还没有孩子第一步或错因说明。',
  structuredEvidenceSignals: {
    subjectLabel: '数学',
    taskType: 'math_word_problem',
    questionType: 'math_word_problem'
  }
});
assert.strictEqual(photoOnlyRuntimeCta.gameRoute, '', 'photo-only wrong-question material does not expose game route before first-step or wrong-cause evidence');
assert.strictEqual(photoOnlyRuntimeCta.tonightTaskCard.gameRoute, '', 'photo-only wrong-question tonight card also keeps game route locked');
assert(photoOnlyRuntimeCta.dailyExecutionSeed && photoOnlyRuntimeCta.dailyExecutionSeed.gameLine.includes('暂不解锁'), 'photo-only daily execution seed keeps game recall locked until evidence exists');
assert.strictEqual(photoOnlyRuntimeCta.dailyExecutionSeed.syncPayload.game_unlocked, false, 'photo-only daily execution seed sync payload records locked game state');

const wrongPaperWithoutEvidenceCta = runtimeUploadPage.buildReportCta({
  sourceSchemaId: 'wrong_question_paper',
  sourceSchemaLabel: '错题/试卷',
  subjectLabel: '数学',
  taskType: 'math_word_problem'
}, {
  reportDraft: {
    id: 'report_runtime_wrong_paper_no_evidence',
    behaviorSignals: {}
  }
}, {
  sourceText: '只上传了错题试卷类型，还没有孩子第一步、错因或导入错题卡。',
  structuredEvidenceSignals: {
    subjectLabel: '数学',
    taskType: 'math_word_problem',
    questionType: 'math_word_problem'
  }
});
assert(wrongPaperWithoutEvidenceCta.actionRoute.includes('material_evidence_gate'), 'wrong-question paper without first-step or wrong-cause evidence routes back to evidence completion instead of review repair');
assert(!wrongPaperWithoutEvidenceCta.actionRoute.includes('/pages/review/review'), 'wrong-question paper cannot enter review repair before real task evidence exists');

console.log('All import intake tests pass.');
